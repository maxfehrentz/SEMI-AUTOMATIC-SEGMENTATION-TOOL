import os
import sys
sys.path.append(os.path.relpath("../FocalClick/isegm/inference/predictors"))
import __init__
import focalclick
sys.path.append(os.path.relpath("../FocalClick/isegm/model"))
import is_segformer_model
sys.path.append(os.path.relpath("../FocalClick/models/focalclick"))
sys.path.append(os.path.relpath("../FocalClick/isegm/inference"))
from clicker import Click

import numpy as np
import torch

import cv2

def compute_mask(image, clicks, prev_mask, predictor,
                    pred_thr=0.49
                    ):

    # converting the clicks to the Click class used in FocalClick; difference in purpose
    # as we might need more than one type of clicks and they only allow bool classification
    click_list = []
    index = 0
    for click in clicks:
        if click.type_of_click == "positive":
            # note: they use y as the first coordinate, not x!
            # also, rounding is necessary as the model needs unique reference pixels, not floats
            new_click = Click(True, (int(click.y), int(click.x)), indx=index)
        elif click.type_of_click == "negative":
            new_click = Click(False, (int(click.y), int(click.x)), indx=index)
        else:
            raise RuntimeError("type of click is unknown")
        index += 1
        click_list.append(new_click)

    progressive_mode = True

    with torch.no_grad():
        # preparing the predictor
        predictor.set_input_image(image)
        if prev_mask is not None:
            predictor.set_prev_mask(prev_mask)

        # pred_probs is already a numpy array
        pred_probs = predictor.get_prediction(click_list)
        # first return value is just the threshold, ignore that
        _, pred_mask = cv2.threshold(pred_probs, pred_thr, 1, cv2.THRESH_BINARY)

        # TODO: EXPERIMENT with this number
        if progressive_mode and len(click_list) > 15:
            last_click = click_list[-1]
            last_x, last_y = last_click.coords[1], last_click.coords[0]
            # will compare the prediction against the previous mask
            # don't need to pass the prev mask though because was already set above
            # need to convert this to numpy because cv2 for erosion and dilation cannot deal with torch tensor
            pred_mask = np.array(predictor.progressive_merge(pred_mask, last_y, last_x))

        # adapted from https://www.geeksforgeeks.org/erosion-dilation-images-using-opencv-python/
        # Creating kernel
        kernel = np.ones((3, 3), np.uint8)
  
        # Using cv2.erode() and cv2.dilate() for cleaning up noise
        eroded = cv2.erode(pred_mask, kernel) 
        dilated = cv2.dilate(eroded, kernel)

    return torch.tensor(dilated)