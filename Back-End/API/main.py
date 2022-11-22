from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from enum import Enum

import torch
from detectron2 import model_zoo
from detectron2.config import get_cfg
from detectron2.engine import DefaultPredictor

import base64
import io
from PIL import Image

import numpy as np
import cv2

# TODO: might remove this later, check when saving of bounding boxes and masks is done
from typing import List
import json

import sys
import os

sys.path.append(os.path.relpath("../FocalClick/isegm/inference"))
from utils import load_is_model
sys.path.append(os.path.relpath("../FocalClick/custom_inference"))
from custom_inference import compute_mask
sys.path.append(os.path.relpath("../FocalClick/isegm/inference/predictors"))
from focalclick import FocalPredictor


app = FastAPI()

# allowing requests coming in from port 3000 (React Front-end)
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

# as np array
global current_segmentation_image
current_segmentation_image = ""

# as pytorch tensors
global mask
mask = None
global prev_mask
prev_mask = None

# paths where to save the current mask and the previous mask
path_to_current_mask = "./masks/current_mask.png"
path_to_prev_mask = "./masks/prev_mask.png"

# TODO: check if necessary
# paths where to save the bounding boxes
path_to_bounding_boxes = "./bounding_boxes/bounding_boxes.json"

clicks = []
device = torch.device('cpu')

# TODO: include instruction in the Readme where to find and download the model
path_to_segmentation_model = "../FocalClick/models/focalclick/segformerB3_S2_comb.pth"
net = load_is_model(path_to_segmentation_model, device)

predictor = FocalPredictor(net, device)

# import and setup the mask r-cnn pretrained on wgisd and data from the AIRLab at Polimi by another student
# for more information, contact riccardo.bertoglio@polimi.it
path_to_cfg_file = "../Mask-RCNN/mask_rcnn_config.yaml"

cfg = get_cfg()

# TODO: this was set to "BGR", why? maybe ask Riccardo
cfg.INPUT.FORMAT = "RGB"

cfg.merge_from_file(path_to_cfg_file)

# all this code has been replaced by the just loading the yaml file that this code created; left for future
# reference

# # get standard parameters for the configuration  
# # TODO: dump all this in a yaml file that can be simply loaded in the future
# model_file = "COCO-InstanceSegmentation/mask_rcnn_R_50_FPN_3x.yaml" 
# cfg.merge_from_file(model_zoo.get_config_file(model_file))

# # loading the weights
# # TODO: exclude this in the .gitignore and mention in the readme.md how to get it
# cfg.MODEL.WEIGHTS = os.path.join("../Mask-RCNN/", "mask-rcnn.pth")

# # run on a cpu
# # TODO: if this ever gets deployed on a server with a GPU, this needs to be changed
# cfg.MODEL.DEVICE = "cpu"

# cfg.MODEL.BACKBONE.FREEZE_AT = 0 
# cfg.MODEL.ROI_HEADS.NUM_CLASSES = 1
# cfg.MODEL.ROI_HEADS.SCORE_THRESH_TEST = 0.9 
# cfg.MODEL.ROI_HEADS.NMS_THRESH_TEST = 0.5

# # dumping the cfg
# f = open("../Mask-RCNN/mask_rcnn_config.yaml", "x")
# print(f"config dump: {cfg.dump()}")
# f.write(cfg.dump())
# f.close()

# setting up the predictor
predictor = DefaultPredictor(cfg)

# list of bounding boxes
bounding_boxes = []


@app.put("/segmentation_image")
async def update_segmentation_image(imageBase64: ImageBase64):
    global current_segmentation_image
    global mask
    global prev_mask

    # adapted from https://stackoverflow.com/questions/57318892/convert-base64-encoded-image-to-a-numpy-array
    decoded_img = base64.b64decode(imageBase64.content)
    decoded_img = Image.open(io.BytesIO(decoded_img))
    current_segmentation_image = np.array(decoded_img, dtype = np.uint8)
    current_segmentation_image = current_segmentation_image[:, :, :-1]

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


@app.put("/bounding_image")
async def update_bounding_image(imageBase64: ImageBase64):
    global current_bounding_image
    global bounding_boxes

    # adapted from https://stackoverflow.com/questions/57318892/convert-base64-encoded-image-to-a-numpy-array
    decoded_img = base64.b64decode(imageBase64.content)
    decoded_img = Image.open(io.BytesIO(decoded_img))
    current_bounding_image = np.array(decoded_img, dtype = np.uint8)

    # resetting the bounding boxes
    bounding_boxes.clear()

    # TODO: implement some sort of saving mechanism once the user is done with the bounding boxes
    # json file will be deleted as well
    if os.path.isfile(path_to_bounding_boxes):
        os.remove(path_to_bounding_boxes)

    # run the mask-rcnn; this is in a detectron2 specific format
    bounding_boxes = predictor(current_bounding_image)

    # TODO: process the bounding boxes for the front-end (and later also the masks)
    # send bounding boxes relative to the image to the front-end, DO NOT save them yet as json files yet;
    # wait for user to correct them
    # same goes for the segmentation masks: wait for user to correct them and only convert the final
    # boxes + masks into COCO/Pascal Voc or whatever format and save them; still the masks need to be
    # extracted here and saved somehow

    # see https://detectron2.readthedocs.io/en/latest/modules/structures.html for details
    instances = bounding_boxes["instances"]
    boxes_tensor = instances.get("pred_boxes").tensor

    return boxes_tensor.tolist()


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
    mask = compute_mask(current_segmentation_image, clicks, prev_mask, predictor)

    save_current_and_prev_mask()

    with open(path_to_current_mask, "rb") as image_file:
        encoded_image = base64.b64encode(image_file.read())

    # return the base64-encoded png to the front-end
    return encoded_image


# TODO: reset needs to become specific for segmentation; might have to implement a reset for
# the bounding as well

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

@app.get("/rollBackClick/")
async def roll_back_click():
    global mask

    # retrieving the png of the previous mask
    if os.path.isfile(path_to_prev_mask):
        # removing the last click
        del clicks[-1]

        # reading the previous mask
        with open(path_to_prev_mask, "rb") as image_file:
            encoded_image = base64.b64encode(image_file.read())

        # setting the masks one step back and writing them to png files
        mask = prev_mask
        save_current_and_prev_mask()

        # return the base64-encoded png of the previous mask to the front-end
        return encoded_image
    
    # in case there is no previous mask yet (e.g. after the first click there is only a current mask)
    # the frontend will be notified
    else:
        raise HTTPException(status_code=404, detail="No previous mask available")



    

    



