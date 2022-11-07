from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from enum import Enum

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
# TODO: import torch
device = torch.device('cpu')
path_to_model = "./FocalClick/models/focalclick/hrnet18s_S1_cclvs.pth"
# TODO: import utils
net = utils.load_is_model(checkpoint_path, device)
# TODO: import predictor
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
    evaluate_sample(current_image, clicks, mask, predictor)
    return clicks, pred_mask




