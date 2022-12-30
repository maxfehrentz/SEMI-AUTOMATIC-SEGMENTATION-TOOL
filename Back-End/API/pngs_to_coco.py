# whole file adapted from https://github.com/chrise96/image-to-coco-json-converter/blob/master/create-custom-coco-dataset.ipynb

import glob

from create_annotations import *

# Label ids of the dataset
category_ids = {
    # note that 0 usually stands for outlier; however
    "grape": 0
}

# Define the ids that are a multipolygon; grapes can be in some instances
multipolygon_ids = [0]


# output_path is the location where the .json file with the COCO annotations will be saved 
# the filenames correspond to the image names
# masks_path corresponds to the folder that holds all the subfolders per image that contain the annotation pngs
def create_COCO_annotations(output_path, filenames, masks_path):
    # Get the standard COCO JSON format
    coco_format = get_coco_json_format()
        
    # Create category section
    coco_format["categories"] = create_category_annotation(category_ids)

    # Create images and annotations sections
    coco_format["images"], coco_format["annotations"], annotation_cnt = images_annotations_info(masks_path, filenames)

    # write results to file
    with open(output_path, "w") as outfile:
        json.dump(coco_format, outfile)
    
    print("Created %d annotations for images in folder: %s" % (annotation_cnt, masks_path))

    return


# Get "images" and "annotations" info 
def images_annotations_info(masks_path, filenames):
    # This id will be automatically increased as we go
    annotation_id = 0
    image_id = 0
    annotations = []
    images = []

    # # the segmentation masks are in separate folders corresponding to the image the masks belong to
    # # adapted from https://stackoverflow.com/questions/800197/how-to-get-all-of-the-immediate-subdirectories-in-python
    # image_folders_with_paths = [f.path for f in os.scandir(maskpath) if f.is_dir()]
    # print(f"subdirs: {list_folders_with_paths}")

    # go through each folder; each represents one image with all the segmentation masks as pngs
    for filename in filenames:    
        
        # the path to the folder for each image is the filename without the extension
        path = os.path.join(masks_path, filename.split(".")[0])

        # we only want to write the image infos once per image/filename
        write_image_infos = True

        for mask_image in glob.glob(path + "/" + "*.png"):

            # Open the image and (to be sure) we convert it to RGB
            mask_image_open = Image.open(mask_image).convert("RGB")
            w, h = mask_image_open.size

            # "images" info, refers to the original file name
            if write_image_infos:
                image = create_image_annotation(filename, w, h, image_id)
                images.append(image)
                write_image_infos = False

            category_id = category_ids["grape"]

            # "annotations" info
            polygons, segmentations = create_sub_mask_annotation(np.array(mask_image_open))

            # Check if we have classes that are a multipolygon
            if category_id in multipolygon_ids:
                # Combine the polygons to calculate the bounding box and area
                multi_poly = MultiPolygon(polygons)
                annotation = create_annotation_format(multi_poly, segmentations, image_id, category_id, annotation_id)
                annotations.append(annotation)
                annotation_id += 1
            else:
                for i in range(len(polygons)):
                    # Cleaner to recalculate this variable
                    segmentation = [np.array(polygons[i].exterior.coords).ravel().tolist()]
                    annotation = create_annotation_format(polygons[i], segmentation, image_id, category_id, annotation_id)
                    annotations.append(annotation)
                    annotation_id += 1

        image_id += 1

    return images, annotations, annotation_id