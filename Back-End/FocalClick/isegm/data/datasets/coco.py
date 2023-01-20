import cv2
import json
import random
import numpy as np
from pathlib import Path
from isegm.data.base import ISDataset
from isegm.data.sample import DSample
from collections import defaultdict


# assuming the object detection data format
class CocoDataset(ISDataset):
    def __init__(self, dataset_path, split='train', stuff_prob=0.0, **kwargs):
        super(CocoDataset, self).__init__(**kwargs)
        self.split = split
        self.dataset_path = Path(dataset_path)
        self.stuff_prob = stuff_prob
        self.max_overlap_ratio = 0.1

        self.load_samples()

    def load_samples(self):
        annotation_path = self.dataset_path / 'annotations' / f'{self.split}.json'
        self.images_path = self.dataset_path / self.split

        with open(annotation_path, 'r') as f:
            json_annotation = json.load(f)

        # save all annotations in self.annotations as value; key is the image_id
        self.annotations = defaultdict(list)
        for x in json_annotation['annotations']:
            self.annotations[x['image_id']].append(x)
        
        # adding all images to self.dataset_samples that have at least one corresponding annotation in self.annotations
        self.dataset_samples = [x for x in json_annotation['images']
                                if len(self.annotations[x['id']]) > 0]


    def get_sample(self, index) -> DSample:
        image_info = self.dataset_samples[index]
        image_id = image_info['id']
        image_filename = image_info['file_name']
        image_annotations = self.annotations[image_id]
        random.shuffle(image_annotations)

        image_path = self.images_path / image_filename
        image = cv2.imread(str(image_path))
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        instances_mask = None
        instances_area = defaultdict(int)
        objects_ids = []

        for indx, obj_annotation in enumerate(image_annotations):
            mask = self.get_mask_from_polygon(obj_annotation, image)
            object_mask = mask > 0
            object_area = object_mask.sum()
            if instances_mask is None:
                instances_mask = np.zeros_like(object_mask, dtype=np.int32)
            overlap_ids = np.bincount(instances_mask[object_mask].flatten())
            overlap_areas = [overlap_area / instances_area[inst_id] for inst_id, overlap_area in enumerate(overlap_ids)
                             if overlap_area > 0 and inst_id > 0]
            overlap_ratio = np.logical_and(object_mask, instances_mask > 0).sum() / object_area
            if overlap_areas:
                overlap_ratio = max(overlap_ratio, max(overlap_areas))
            if overlap_ratio > self.max_overlap_ratio:
                continue
            instance_id = indx + 1
            instances_mask[object_mask] = instance_id
            instances_area[instance_id] = object_area
            objects_ids.append(instance_id)

        return DSample(image, instances_mask, objects_ids=objects_ids)


    @staticmethod
    def get_mask_from_polygon(annotation, image):
        mask = np.zeros(image.shape[:2], dtype=np.int32)
        for contour_points in annotation['segmentation']:
            contour_points = np.array(contour_points).reshape((-1, 2))
            contour_points = np.round(contour_points).astype(np.int32)[np.newaxis, :]
            cv2.fillPoly(mask, contour_points, 1)

        return mask
