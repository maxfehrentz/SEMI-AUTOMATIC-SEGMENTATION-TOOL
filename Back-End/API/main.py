from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from enum import Enum
import torch
import base64
import io
from PIL import Image
import numpy as np
import cv2

import sys
import os
sys.path.append(os.path.relpath("../FocalClick/isegm/inference"))
from utils import load_is_model
sys.path.append(os.path.relpath("../FocalClick/custom_inference"))
from custom_inference import compute_mask
sys.path.append(os.path.relpath("../FocalClick/isegm/inference/predictors"))
from focalclick import FocalPredictor

# creating a data model for receiving the current image that was chosen in the frontend by the user in Base64 format
# details on data models in FastAPI can be found here: https://fastapi.tiangolo.com/tutorial/body/
class ImageBase64(BaseModel):
    content: bytes

# making an enum instead of using bool because later we might have automatically generated clicks
# and it might be necessary to indicate that, e.g. with "artif_pos"
class ClickType(str, Enum):
    positive = "positive"
    negative = "negative"

class Click(BaseModel):
    x: float
    y: float
    typeOfClick: ClickType

app = FastAPI()

# as np array
global current_image
current_image = ""

# as pytorch tensors
global mask
mask = None
global prev_mask
prev_mask = None

# paths where to save the current mask and the previous mask
path_to_current_mask = "./current_mask.png"
path_to_prev_mask = "./prev_mask.png"

clicks = []
device = torch.device('cpu')

# TODO: include instruction in the Readme where to find and download the model
# path_to_model = "../FocalClick/models/focalclick/hrnet18s_S1_cclvs.pth"
path_to_model = "../FocalClick/models/focalclick/segformerB3_S2_comb.pth"
net = load_is_model(path_to_model, device)

predictor = FocalPredictor(net, device)

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://10.168.67.36:3000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.put("/image")
async def update_image(imageBase64: ImageBase64):
    global current_image
    global mask
    global prev_mask

    # adapted from https://stackoverflow.com/questions/57318892/convert-base64-encoded-image-to-a-numpy-array
    decoded_img = base64.b64decode(imageBase64.content)
    decoded_img = Image.open(io.BytesIO(decoded_img))
    current_image = np.array(decoded_img, dtype = np.uint8)
    current_image = current_image[:, :, :-1]

    # resetting the clicks
    clicks.clear()

    # resetting the mask
    mask = None
    prev_mask = None

    # image files will be deleted as well
    if os.path.isfile(path_to_current_mask):
        os.remove(path_to_current_mask)
    if os.path.isfile(path_to_prev_mask):
        os.remove(path_to_prev_mask)

    return


def save_current_and_prev_mask():
    mask_np = mask.numpy()
    zero_matrix = np.zeros_like(mask_np)

    # adding transparency channel derived from the mask to make the red area more transparent and the rest fully transparent
    full_image = cv2.merge((zero_matrix, zero_matrix, mask_np * 255, mask_np * 127))

    if prev_mask is not None:
        # in that case, we know that a previous mask already existed
        # we move it to preserve it
        os.rename('current_mask.png', 'prev_mask.png')

    # save the full_image
    cv2.imwrite(path_to_current_mask, full_image)


@app.post("/clicks/")
async def add_click(click: Click):
    global mask
    global prev_mask

    # saving the mask before updating it
    prev_mask = mask

    clicks.append(click)
    mask = compute_mask(current_image, clicks, prev_mask, predictor)

    save_current_and_prev_mask()

    with open(path_to_current_mask, "rb") as image_file:
        encoded_image = base64.b64encode(image_file.read())

    # return the base64-encoded png to the front-end
    return encoded_image


# leaves the image but resets the clicks and the mask
@app.post("/reset/")
async def reset():
    global mask
    global prev_mask

    mask = None
    prev_mask = None

    # image files will be deleted as well
    if os.path.isfile(path_to_current_mask):
        os.remove(path_to_current_mask)
    if os.path.isfile(path_to_prev_mask):
        os.remove(path_to_prev_mask)

    clicks.clear()

    return

@app.post("/rollBackClick/")
async def roll_back_click():
    global mask

    # removing the last click
    del clicks[-1]

    # retrieving the png of the previous mask
    with open(path_to_prev_mask, "rb") as image_file:
        encoded_image = base64.b64encode(image_file.read())

    # setting the masks one step back and writing them to png files
    mask = prev_mask
    save_current_and_prev_mask()

    # return the base64-encoded png of the previous mask to the front-end
    return encoded_image



