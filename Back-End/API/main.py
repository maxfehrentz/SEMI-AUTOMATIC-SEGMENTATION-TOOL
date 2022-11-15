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

# TODO: in ? format
global mask
mask = None

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

    # adapted from https://stackoverflow.com/questions/57318892/convert-base64-encoded-image-to-a-numpy-array
    decoded_img = base64.b64decode(imageBase64.content)
    decoded_img = Image.open(io.BytesIO(decoded_img))
    current_image = np.array(decoded_img, dtype = np.uint8)
    current_image = current_image[:, :, :-1]

    # resetting the clicks
    clicks.clear()

    # resetting the mask
    mask = None

    return

# TODO: move the whole click logic into the backend; figure out best practices to
# add/delete/reset clicks
@app.post("/clicks/")
async def add_clicks(click: Click):
    global mask

    clicks.append(click)
    mask = compute_mask(current_image, clicks, mask, predictor)

    # saving the mask as an image and providing the front-end with a URL to load it from
    mask_np = mask.numpy()
    zero_matrix = np.zeros_like(mask_np)

    # adding transparency channel derived from the mask to make the red area more transparent and the rest fully transparent
    full_image = cv2.merge((zero_matrix, zero_matrix, mask_np * 255, mask_np * 127))

    # save the full_image
    abs_img_path = "/Users/max/Documents/Studium/Semester7/Thesis/Semi_automatic_segmentation_tool/Back-End/API/current_mask.png"
    cv2.imwrite(abs_img_path, full_image)


    # TODO: later, clicks will have to be returned here so that all the logic is contained in the backend
    return




