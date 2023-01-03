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

import shutil

# used for visualization of annotations
import fiftyone as fo
import fiftyone.zoo as foz

sys.path.append(os.path.relpath("../FocalClick/isegm/inference"))
from utils import load_is_model
sys.path.append(os.path.relpath("../FocalClick/custom_inference"))
from custom_inference import compute_mask
sys.path.append(os.path.relpath("../FocalClick/isegm/inference/predictors"))
from focalclick import FocalPredictor

from pngs_to_coco import *

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
    name: str


# making an enum instead of using bool because later we might have automatically generated clicks
# and it might be necessary to indicate that, e.g. with "artif_pos"
class ClickType(str, Enum):
    positive = "positive"
    negative = "negative"


class Click(BaseModel):
    x: float
    y: float
    type_of_click: ClickType


# classes to interface with the frontend
class BoundingBox(BaseModel):
    x: float
    y: float
    width: float
    height: float
    id: int


class BoundingBoxList(BaseModel):
    bounding_boxes: List[BoundingBox]


# class to interface with the mask-rcnn
class ROI():
    def __init__(self, bounding_box: torch.Tensor, suggested_mask: torch.Tensor = None):
        # each bounding box is represented by the lower left and the upper right corner: x1, y1, x2, y2
        self.bounding_box = bounding_box
        self.suggested_mask = suggested_mask

# as np array 
global current_bounding_image
global current_filename
global filenames
current_bounding_image = None
current_filename = ""
filenames = []

# as np array
global current_segmentation_image
current_segmentation_image = None

# as pytorch tensors
global mask
mask = None
global prev_mask
prev_mask = None

# dictionary of ROIs, key is the identifier, value is the ROI object
rois = dict()

# paths where to save the helper and output files
# helper files
tmp_folder = "./tmp"
segment_folder = os.path.join(tmp_folder, "segments")
path_to_segment = os.path.join(segment_folder, "current_segment.png")
mask_folder = os.path.join(tmp_folder, "masks")
image_folder = os.path.join(tmp_folder, "images")
path_to_current_mask = os.path.join(mask_folder, "current_mask.png")
path_to_prev_mask = os.path.join(mask_folder, "prev_mask.png")

# output files
# basically it is also a helper file as this will also be saved in a location specified in the frontend
output_path = os.path.join(tmp_folder, "annotations.json")

# create the necessary folders
if not os.path.isdir(segment_folder):
    os.makedirs(segment_folder)
if not os.path.isdir(mask_folder):
    os.makedirs(mask_folder)
if not os.path.isdir(image_folder):
    os.makedirs(image_folder)

clicks = []

device = torch.device('cpu')

# TODO: include instruction in the Readme where to find and download the model
path_to_segmentation_model = "../FocalClick/models/focalclick/segformerB3_S2_comb.pth"
net = load_is_model(path_to_segmentation_model, device)

focal_click_predictor = FocalPredictor(net, device)

# import and setup the mask r-cnn pretrained on wgisd and data from the AIRLab at Polimi by another student
# for more information, contact riccardo.bertoglio@polimi.it
path_to_cfg_file = "../Mask-RCNN/mask_rcnn_config.yaml"

cfg = get_cfg()

# setting the input format
cfg.INPUT.FORMAT = "RGB"

# loading the config from the yaml file
cfg.merge_from_file(path_to_cfg_file)


# # all this code has been replaced by the just loading the yaml file that this code created; left for future
# # reference

# # get standard parameters for the configuration  
# # TODO: dump all this in a yaml file that can be simply loaded in the future
# model_file = "Misc/scratch_mask_rcnn_R_50_FPN_9x_gn.yaml" 
# cfg.merge_from_file(model_zoo.get_config_file(model_file))

# # loading the weights
# # TODO: exclude this in the .gitignore and mention in the readme.md how to get it
# cfg.MODEL.WEIGHTS = os.path.join("../Mask-RCNN/", "model_RGB.pth")

# # run on a cpu
# # TODO: if this ever gets deployed on a server with a GPU, this needs to be changed
# cfg.MODEL.DEVICE = "cpu"

# cfg.MODEL.BACKBONE.FREEZE_AT = 0 
# cfg.MODEL.ROI_HEADS.NUM_CLASSES = 1
# cfg.MODEL.ROI_HEADS.SCORE_THRESH_TEST = 0.9 
# cfg.MODEL.ROI_HEADS.NMS_THRESH_TEST = 0.5

# # dumping the cfg
# f = open("../Mask-RCNN/mask_rcnn_config.yaml", "x")
# f.write(cfg.dump())
# f.close()


# setting up the predictor for the Mask-RCNN
mask_rcnn_predictor = DefaultPredictor(cfg)


# TODO: better naming! this also saves the masks
# TODO: create docstrings for the methods in the very end
def update_segment(image, initial_mask = None):
    global current_segmentation_image
    global mask
    global prev_mask

    # setting the new segmentation image
    current_segmentation_image = image

    # resetting the clicks
    clicks.clear()

    # deleting all files
    if os.path.isfile(path_to_segment):
        os.remove(path_to_segment)
    if os.path.isfile(path_to_current_mask):
        os.remove(path_to_current_mask)
    if os.path.isfile(path_to_prev_mask):
        os.remove(path_to_prev_mask)

    # saving the segment
    cv2.imwrite(path_to_segment, cv2.cvtColor(current_segmentation_image, cv2.COLOR_RGB2BGR))

    # TODO: think about saving mechanisms and folders: what should be saved permanently, what
    # will be overridden during use?

    # resetting/initializing and saving the masks
    prev_mask = None
    if initial_mask is None:
        mask = None
    else:
        mask = initial_mask
        save_current_and_prev_mask()

    return


@app.put("/bounding-image")
# TODO: find more suitable name than "bounding image"
async def update_bounding_image(imageBase64: ImageBase64):
    global current_bounding_image
    global current_filename
    global filenames

    current_filename = imageBase64.name
    filenames.append(current_filename)

    # adapted from https://stackoverflow.com/questions/57318892/convert-base64-encoded-image-to-a-numpy-array
    decoded_img = base64.b64decode(imageBase64.content)
    decoded_img = Image.open(io.BytesIO(decoded_img))
    current_bounding_image = np.array(decoded_img, dtype = np.uint8)

    # save each image locally; the reason is that to visualize the annotations in the very end with fiftyone,
    # it is necessary to feed the path to the original images; however, the browser may grant access to them via
    # the frontend, but the full system path is never revealed to any browser for privacy reasons and therefore,
    # the backend has no way of pointing to the folder with the original images that were annotated
    path_to_image = os.path.join(image_folder, current_filename)
    success = cv2.imwrite(path_to_image, cv2.cvtColor(current_bounding_image, cv2.COLOR_RGB2BGR))
    if not success:
        raise Exception("Writing the image failed!")

    image_height, image_width, _ = np.shape(current_bounding_image)

    # resetting the rois
    rois.clear()

    # run the mask-rcnn; the output is in a detectron2 specific format
    # see https://detectron2.readthedocs.io/en/latest/modules/structures.html for details
    mask_rccn_output = mask_rcnn_predictor(current_bounding_image)

    instances = mask_rccn_output["instances"]
    # the tensor is of shape (number of boxes, 4), where the 4 entries are x1, y1, x2, and y2
    # they represent the coordinates of the upper left and lower right corner
    boxes_tensors = instances.get("pred_boxes").tensor
    # while it will not be returned now, it is also important to extract the masks as well
    masks_tensors = instances.get("pred_masks")

    # TODO: also implement retrieving the predicted classes and make it potentially multiclass in the ROI class

    # the boxes receive unique ids
    boxes_with_id = []
    # the boxes will be widened a bit since the mask r-cnn gives very narrow bounding boxes which is
    # not ideal for the iterative correction
    widening_factor = 1.1
    for i in range(len(boxes_tensors)):
        x1, y1, x2, y2 = boxes_tensors.numpy()[i]

        width = x2 - x1
        height = y2 - y1

        additional_width = width * (widening_factor - 1)
        additional_height = height * (widening_factor - 1)

        new_x1 = x1 - (additional_width / 2)
        new_x2 = x2 + (additional_width / 2)
        new_y1 = y1 - (additional_height / 2)
        new_y2 = y2 + (additional_height / 2)

        # check for each new "widened" coordinate whether it is still in the image
        if new_x1 < 0 or new_x1 > image_width:
            new_x1 = x1
        if new_x2 < 0 or new_x2 > image_width:
            new_x2 = x2
        if new_y1 < 0 or new_y1 > image_height:
            new_y1 = y1
        if new_y2 < 0 or new_y2 > image_height:
            new_y2 = y2

        new_bounding_box_tensor = torch.Tensor([new_x1, new_y1, new_x2, new_y2])
        rois.update({i: ROI(bounding_box = new_bounding_box_tensor, suggested_mask = masks_tensors[i])})

        # the rois dict is for the backend; however, the frontend needs just the boxes with their ids
        boxes_with_id.append(new_bounding_box_tensor.tolist() + [i])

    return boxes_with_id


def save_current_and_prev_mask():
    mask_np = mask.numpy()
    zero_matrix = np.zeros_like(mask_np)

    # adding transparency channel derived from the mask to make the red area 
    # more transparent and the rest fully transparent
    mask_image = cv2.merge((zero_matrix, zero_matrix, mask_np * 255, mask_np * 127))

    if prev_mask is not None:
        # in that case, we know that a previous mask already existed
        # we move it to preserve it
        os.rename(path_to_current_mask, path_to_prev_mask)

    # save the mask image
    # here the usual conversion for CV2 from RGB to BGR is not necessary as the mask_image is already in this format
    success = cv2.imwrite(path_to_current_mask, mask_image)
    if not success:
        raise Exception("Writing the mask failed!")

    return


@app.post("/clicks/")
async def add_click(click: Click):
    global mask
    global prev_mask

    # saving the mask before updating it
    prev_mask = mask

    clicks.append(click)
    mask = compute_mask(current_segmentation_image, clicks, prev_mask, focal_click_predictor)

    save_current_and_prev_mask()

    with open(path_to_current_mask, "rb") as image_file:
        encoded_image = base64.b64encode(image_file.read())

    # return the base64-encoded png to the front-end
    return encoded_image


# TODO: reset needs to become specific for segmentation; might have to implement a reset for
# the bounding as well

# leaves the image part that is being segmented but resets the clicks and the mask
@app.post("/reset-segmentation/")
async def reset_segmentation():
    global mask
    global prev_mask

    mask = None
    prev_mask = None

    # image files of the masks will be deleted, the segmentation image remains
    # because this resets only the segmentation process, not the segment
    # to be segmented
    if os.path.isfile(path_to_current_mask):
        os.remove(path_to_current_mask)
    if os.path.isfile(path_to_prev_mask):
        os.remove(path_to_prev_mask)

    clicks.clear()

    return


# way for the frontend to communicate that a mask is finished
# TODO: some urls are with -, others use Camel case; figure out what's the right convention
@app.post("/mask-finished/{id}")
async def mask_finished(id):

    # take the mask as it was currently saved and augment it so it is in the right place relative to the full image
    augmented_mask = np.zeros(shape = np.shape(current_bounding_image)[:-1])
    bounding_box = rois.get(int(id)).bounding_box
    x1 = int(bounding_box[0])
    y1 = int(bounding_box[1])
    x2 = int(bounding_box[2])
    y2 = int(bounding_box[3])
    zero_mask = augmented_mask
    augmented_mask[y1:y2, x1:x2] = mask

    # create image
    mask_image = cv2.merge((zero_mask, zero_mask, augmented_mask * 255))

    # save
    split_filename = current_filename.split(".")
    filename_without_extension = split_filename[0]

    path_dir = os.path.join(mask_folder, filename_without_extension)
    # in case this is the first segment, the folder for this image does not exist yet
    if not os.path.isdir(path_dir):
        os.mkdir(path_dir)
    path = os.path.join(mask_folder, filename_without_extension + "/" + id + ".png")
    success = cv2.imwrite(path, mask_image)
    if not success:
        raise Exception("Writing the image failed!")
        


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


def add_bounding_box_to_rois(box):
    x = 0
    limit_x = 0
    if box.width > 0:
        x = box.x
        limit_x = box.x + box.width
    else:
        x = box.x + box.width
        limit_x = box.x

    y = 0
    limit_y = 0
    if box.height > 0:
        y = box.y
        limit_y = box.y + box.height
    else:
        y = box.y + box.height
        limit_y = box.y

    rois[box.id] = ROI(
        bounding_box = torch.tensor([
            x, 
            y, 
            limit_x,
            limit_y]))

    return



@app.put("/bounding-boxes")
async def save_bounding_boxes_from_frontend(bounding_box_list: BoundingBoxList):

    print(f"received bounding boxes: {bounding_box_list.bounding_boxes}")

    for frontend_box in bounding_box_list.bounding_boxes:

        # checks whether the key is in the dict, meaning that this box is already registered in the backend
        if frontend_box.id in rois:

            # get box corresponding to that id in the backend to compare
            backend_box = rois.get(frontend_box.id).bounding_box
            # corresponds to x2 - x1
            backend_box_width = backend_box[2] - backend_box[0]
            # corresponds to y2 - y1
            backend_box_height = backend_box[3] - backend_box[1]

            # need to check whether the box has been changed; if yes, the mask also becomes invalid
            if(
                # [0] corresponds to x1
                frontend_box.x != backend_box[0]
                # [1] corresponds to y1
                or frontend_box.y != backend_box[1]
                or frontend_box.width != backend_box_width
                or frontend_box.height != backend_box_height
            ):
                # the box has been changed in the frontend, therefore the box from the
                # frontend replaces the box that was initially generated by the mask-rcnn
                # moreover, we do not pass a mask, which then defaults to None; this removes the initally
                # suggested mask on purpose, because since the bounding box has been changed,
                # we cannot trust the mask either
                add_bounding_box_to_rois(frontend_box)

        # boxes that are not in the rois have been added in the frontend and therefore also have no mask
        else:
            add_bounding_box_to_rois(frontend_box)


    # loop over the keys (ids) and remove the bounding boxes from the rois dict, that were not
    # returned from the frontend, since that means they have been removed by the user
    keys_to_be_removed = []

    for key in rois.keys():
        if key not in map(lambda box: box.id, bounding_box_list.bounding_boxes):
            keys_to_be_removed.append(key)

    for key in keys_to_be_removed:
        del rois[key]

    return


@app.get("/segments/{id}")
async def get_segment_with(id: int):
    
    # TODO: do error handling here in case nonsense ids are being passed
    print(f"id requested: {id}")

    x_origin = int(rois.get(id).bounding_box[0])
    y_origin = int(rois.get(id).bounding_box[1])
    x_limit = int(rois.get(id).bounding_box[2])
    y_limit = int(rois.get(id).bounding_box[3])

    # get the relevant part of the image
    image_segment = current_bounding_image[y_origin:y_limit, x_origin:x_limit, :]

    # get the relevant mask, might be None, e.g. if the roi did not come from the mask rcnn but
    # was created in the frontend, or if an existing bounding box was scaled or moved by the user
    mask = rois.get(id).suggested_mask
    
    # calling update_segment will setup everything for the new segment in the backend
    if mask is None:
        update_segment(image_segment)
    else:
        # cropping the mask as well to the releveant area
        mask = mask[y_origin:y_limit, x_origin:x_limit]
        # .long() is necessary to convert the mask to numbers, because
        # the mask r-cnn returns a boolean tensor
        update_segment(image_segment, mask.long())
    

    # return both image and mask to the frontend
    with open(path_to_segment, "rb") as image_file:
        encoded_segment = base64.b64encode(image_file.read())

    encoded_mask = ""
    if mask is not None:
        with open(path_to_current_mask, "rb") as image_file:
            encoded_mask = base64.b64encode(image_file.read())

    return [encoded_segment, encoded_mask]

    
@app.get("/coco-annotations/")
async def get_coco_annotations():
    # note that this saves a json file to the output_path; the same content will be passed to the frontend
    # in order to be saved to a user defined location; for privacy reasons, the full path the
    # user chose in the frontend is not fully revealed to the browser and therefore the backend
    # does not know where the user wants to save the file. It is saved for visualization in fiftyone,
    # but it has to be passed back to the frontend for saving in the desired location
    create_COCO_annotations(output_path, filenames, mask_folder)

    with open(output_path, "rb") as json_file:
        coco_as_string = json_file.read()

    # Load COCO-formated json file
    # TODO: the classes need to be generalized
    coco_dataset = fo.Dataset.from_dir(
        dataset_type=fo.types.COCODetectionDataset,
        data_path=image_folder,
        labels_path=output_path,
        include_id=True
    )
    # starting a fiftyone session in a separate window to inspect the annotations
    session = fo.launch_app(coco_dataset)

    # return the coco annotations as a string to the frontend to be saved in a user defined location
    return coco_as_string


# some cleanup when the app is completely terminated
@app.on_event("shutdown")
def delete_tmp():
    if os.path.isdir(tmp_folder):
        shutil.rmtree(tmp_folder)
    return

# doing a full reset of everything that carries state when a annotation process finishes
# an annotation process here starts with picking the images to be annotated and ends with saving the annotations
@app.post("/annotation-process-finished")
async def full_reset():
    # TODO: figure out if those globals are necessary or if defining that in the very start is enough
    global current_bounding_image
    global current_filename
    global filenames
    current_bounding_image = None
    current_filename = ""
    filenames.clear()
    
    global current_segmentation_image
    current_segmentation_image = None
    
    global mask
    mask = None
    global prev_mask
    prev_mask = None
    
    global rois
    rois.clear()
    
    clicks.clear()

    return

