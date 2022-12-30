# whole file adapted from https://github.com/chrise96/image-to-coco-json-converter/blob/master/create-custom-coco-dataset.ipynb

from PIL import Image                                      
import numpy as np                                         
from skimage import measure                        
from shapely.geometry import Polygon, MultiPolygon         
import os
import json

def create_sub_mask_annotation(sub_mask):
    # Find contours (boundary lines) around the sub-mask
    # Note: there could be multiple contours if the object
    # is partially occluded. (E.g. an elephant behind a tree)
    
    # taking the 0 dimension from the sub_mask array; only need the red channel for the masks
    # NOTE: this does not generalize well! In case different colors are used to color masks, this will fail
    # and not find contours
    contours = measure.find_contours(np.array(sub_mask[:, :, 0]), 0.5, positive_orientation="low")

    # TODO: check if the COCO annotations actually make sense; see if there is a way to translate back

    polygons = []
    segmentations = []
    for contour in contours:
        # Flip from (row, col) representation to (x, y)
        # and subtract the padding pixel
        # TODO: maybe remove the padding pixel? not sure if they are necessary anymore
        for i in range(len(contour)):
            row, col = contour[i]
            contour[i] = (col - 1, row - 1)

        # Make a polygon and simplify it
        poly = Polygon(contour)
        poly = poly.simplify(1.0, preserve_topology=False)
        
        if(poly.is_empty):
            # Go to next iteration, dont save empty values in list
            continue

        polygons.append(poly)

        segmentation = np.array(poly.exterior.coords).ravel().tolist()
        segmentations.append(segmentation)
    
    return polygons, segmentations

def create_category_annotation(category_dict):
    category_list = []

    for key, value in category_dict.items():
        category = {
            "supercategory": "",
            "id": value,
            "name": key
        }
        category_list.append(category)

    return category_list

def create_image_annotation(file_name, width, height, image_id):
    images = {
        "file_name": file_name,
        "height": height,
        "width": width,
        "id": image_id
    }

    return images

def create_annotation_format(polygon, segmentation, image_id, category_id, annotation_id):
    min_x, min_y, max_x, max_y = polygon.bounds
    width = max_x - min_x
    height = max_y - min_y
    bbox = (min_x, min_y, width, height)
    area = polygon.area

    annotation = {
        "segmentation": segmentation,
        "area": area,
        "iscrowd": 0,
        "image_id": image_id,
        "bbox": bbox,
        "category_id": category_id,
        "id": annotation_id
    }

    return annotation

def get_coco_json_format():
    # Standard COCO format 
    coco_format = {
        "info": {},
        "licenses": [],
        "images": [{}],
        "categories": [{}],
        "annotations": [{}]
    }

    return coco_format