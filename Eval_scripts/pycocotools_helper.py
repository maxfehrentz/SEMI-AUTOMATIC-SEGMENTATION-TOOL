# the library does not accept annotations with id 0, see https://github.com/cocodataset/cocoapi/pull/332
# therefore, this script is used to convert a json file in COCO format to a compatible one, 
# simpling by adding 1 to all segmentation ids

# there is also a problem when the image ids do not start from 1; since there is only one image
# it is sufficient to set that image id to 1 to make it compatible with pycocotools
import sys
import os
import json

def main(argv):

    if len(argv) == 1:
        annotation_file_path = argv[0]

        if os.path.isfile(annotation_file_path):
            # reading the JSON file
            with open(annotation_file_path, 'r') as file:
              annotations_json = json.load(file)

            # update the image id
            for image in annotations_json["images"]:
                image["id"] = 1
                break

            # Update the segmentation ids and image ids in the annotations
            for annotation in annotations_json["annotations"]:
                current_id = annotation["id"]
                annotation["id"] = current_id + 1
                annotation["image_id"] = 1

            # Write the modified data to a new file; note that this new file needs to be in the same location as the original annotation file,
            # otherwise, the relative paths to the images in the annotations will not be correct anymore
            dir_name = os.path.dirname(annotation_file_path)
            corrected_ids_annotation_path = os.path.join(dir_name, "corrected_ids.json")
            with open(corrected_ids_annotation_path, "w") as file:
                json.dump(annotations_json, file)

        else:
            print(f"The given path {annotation_file_path} does not lead to a file.")
            return 
    else:
        print(f"Expected one argument, but {len(argv)} were given.")
        return

if __name__ == "__main__":
   main(sys.argv[1:])