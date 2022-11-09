from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from enum import Enum
import torch
import base64
import io
from PIL import Image
import numpy as np

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
path_to_model = "../FocalClick/models/focalclick/hrnet18s_S1_cclvs.pth"
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

    # TODO: figure out what the best practice is for returning stuff
    return imageBase64.content

# TODO: move the whole click logic into the backend; figure out best practices to
# add/delete/reset clicks
@app.post("/clicks/")
async def add_clicks(click: Click):
    global mask

    clicks.append(click)
    mask = compute_mask(current_image, clicks, mask, predictor)
    return clicks, mask




