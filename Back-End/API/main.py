from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from enum import Enum
import torch

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
    content: str

class ClickType(str, Enum):
    positive = "positive"
    negative = "negative"

class Click(BaseModel):
    x: float
    y: float
    typeOfClick: ClickType

app = FastAPI()

current_image = ""
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
    current_image = imageBase64.content
    # resetting the clicks
    clicks.clear()
    return current_image

# TODO: move the whole click logic into the backend
@app.post("/clicks/")
async def add_clicks(click: Click):
    print(f"received new click at {click.x} and {click.y} of type {click.typeOfClick}")
    clicks.append(click)
    compute_mask(current_image, clicks, mask, predictor)
    return clicks, pred_mask




