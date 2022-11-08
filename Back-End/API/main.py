from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from enum import Enum
import torch
import base64
import io
from PIL import Image

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

class ClickType(str, Enum):
    positive = "positive"
    negative = "negative"

class Click(BaseModel):
    x: float
    y: float
    typeOfClick: ClickType

app = FastAPI()

# in base64 format
global current_image
current_image = ""

# as Pytorch tensor
global current_image_tensor
current_image_tensor = None

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

@app.get("/")
async def root():
    print("root accessed")
    return "Hi AIRLab"

@app.put("/image")
async def update_image(imageBase64: ImageBase64):
    global current_image
    global current_image_tensor

    current_image = imageBase64.content

    # adapted from https://stackoverflow.com/questions/57318892/convert-base64-encoded-image-to-a-numpy-array
    decoded_img = base64.b64decode(current_image)
    decoded_img = Image.open(io.BytesIO(decoded_img))
    img_np = np.array(decoded_img, dtype = np.uint8)

    # leads to an image with four channels instead of three; fourth channel is only 255 though
    current_image_tensor = torch.tensor(img_np[:, :, :-1])

    # resetting the clicks
    clicks.clear()

    return current_image

# TODO: move the whole click logic into the backend
@app.post("/clicks/")
async def add_clicks(click: Click):
    print(f"received new click at {click.x} and {click.y} of type {click.typeOfClick}")
    clicks.append(click)
    compute_mask(current_image_tensor, clicks, mask, predictor)
    return clicks, pred_mask




