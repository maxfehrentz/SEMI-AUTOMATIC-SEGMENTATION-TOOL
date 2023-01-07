import sys, os
import fiftyone as fo
import fiftyone.zoo as foz
import json

def main(argv):
    print(argv)

    if len(argv) == 1 or len(argv) == 2:
        annotation_file_path = argv[0]

        if os.path.isfile(annotation_file_path):
            # reading the JSON file and updating it by norming the image paths; otherwise Fifty One cannot deal with them
            with open(annotation_file_path, 'r') as file:
              updated_annotations = json.load(file)

            # Update the values for the specified key
            for image in updated_annotations["images"]:
              if "file_name" in image:
                image["file_name"] = os.path.normpath(image["file_name"])

            # Write the modified data to a new file; note that this new file needs to be in the same location as the original annotation file,
            # otherwise, the relative paths to the images in the annotations will not be correct anymore
            dir_name = os.path.dirname(annotation_file_path)
            tmp_updated_annotations_path = os.path.join(dir_name, "tmp.json")
            with open(tmp_updated_annotations_path, "w") as file:
                json.dump(updated_annotations, file)

            if len(argv) == 1:
                # load the data and the annotations into a Fifty One dataset; data paths are relative to the directory that the annotation file is in
                coco_dataset = fo.Dataset.from_dir(
                    dataset_type=fo.types.COCODetectionDataset,
                    data_path=dir_name,
                    labels_path=tmp_updated_annotations_path,
                    include_id=True
                )
            else:
                # load the data and the annotations into a Fifty One dataset; data paths are relative to the directory passed as an argument
                coco_dataset = fo.Dataset.from_dir(
                    dataset_type=fo.types.COCODetectionDataset,
                    data_path=argv[1],
                    labels_path=tmp_updated_annotations_path,
                    include_id=True
                )

            # starting a fiftyone session in a separate window to inspect the annotations
            session = fo.launch_app(coco_dataset)

            # waiting for the user to be done, then cleaning up
            input("Press enter when you're done inspecting the data:\n")
            session.close()
            os.remove(tmp_updated_annotations_path)

        else:
            print(f"The given path {annotation_file_path} does not lead to a file.")
            return 
    else:
        print(f"Expected one or two arguments, but {len(argv)} were given.")
        return

if __name__ == "__main__":
   main(sys.argv[1:])