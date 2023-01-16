import os

# paths where to save the helper and output files:
# 1) helper files
# TODO: will this work in windows?
tmp_folder = "./tmp"
segment_folder = os.path.join(tmp_folder, "segments")
path_to_segment = os.path.join(segment_folder, "current_segment.png")
mask_folder = os.path.join(tmp_folder, "masks")
image_folder = os.path.join(tmp_folder, "images")
path_to_current_mask = os.path.join(mask_folder, "current_mask.png")
path_to_prev_mask = os.path.join(mask_folder, "prev_mask.png")
# 2) output files
# basically it is also a helper file as the file will also be saved in a location specified in the frontend
output_path = os.path.join(tmp_folder, "annotations.json")

# FocalClick
path_to_segmentation_model = "../FocalClick/models/focalclick/segformerB3_S2_comb.pth"

# Mask R-CNN
path_to_cfg_file = "../Mask-RCNN/mask_rcnn_config.yaml"