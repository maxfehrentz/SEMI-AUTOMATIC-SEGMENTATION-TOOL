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

class Point(BaseModel):
    x: float
    y: float
    typeOfClick: ClickType

app = FastAPI()

current_image = ""

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
    # TODO: convert this back to the format required by FocalClick
    return current_image

@app.post("/points/")
async def add_point(point: Point):
    print(f"received new point at {point.x} and {point.y} of type {point.typeOfClick}")
    return point




