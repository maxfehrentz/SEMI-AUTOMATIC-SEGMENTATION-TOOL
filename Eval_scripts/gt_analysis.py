# this file can be used to load an annotation and compare it to the ground truth
import sys, os
import fiftyone as fo
from fiftyone.utils.eval.segmentation import evaluate_segmentations
from fiftyone.core.fields import IntField
import json

def main(argv):
    print(argv)

    if len(argv) == 3:
        gt_path = argv[0]
        pred_path = argv[1]
        image_folder = argv[2]

        annotation_paths = [gt_path, pred_path]
        datasets = []
        for path in annotation_paths:
            if os.path.isfile(path):
                # reading the JSON file and updating it by norming the image paths; otherwise Fifty One cannot deal with them
                with open(path, 'r') as file:
                  updated_annotations = json.load(file)

                # Update the values for the specified key
                for image in updated_annotations["images"]:
                  if "file_name" in image:
                    image["file_name"] = os.path.normpath(image["file_name"])

                # Write the modified data to a new file; note that this new file needs to be in the same location as the original annotation file,
                # otherwise, the relative paths to the images in the annotations will not be correct anymore
                dir_name = os.path.dirname(path)
                tmp_updated_annotations_path = os.path.join(dir_name, "tmp.json")
                with open(tmp_updated_annotations_path, "w") as file:
                    json.dump(updated_annotations, file)

                # load the data and the annotations into a Fifty One dataset; data paths are relative to the directory that the annotation file is in
                coco_dataset = fo.Dataset.from_dir(
                    dataset_type=fo.types.COCODetectionDataset,
                    data_path=image_folder,
                    labels_path=tmp_updated_annotations_path,
                    include_id=True)
                datasets.append(coco_dataset)

            else:
                print(f"The given path {annotation_file_path} does not lead to a file.")
                return 

        
        # following https://docs.voxel51.com/tutorials/evaluate_detections.html to add predictions to ground truth
        gt_dataset = datasets[0]
        pred_dataset = datasets[1]
        
        pred_field = "pred_segmentations"
        for gt_sample in gt_dataset:
            # for each sample in the gt, we need to find the corresponding one in the predictions
            # performance bottleneck!!! 
            file_path = gt_sample["filepath"]
            for pred_sample in pred_dataset:
                if pred_sample["filepath"] == file_path:
                    gt_sample[pred_field] = pred_sample["segmentations"]
                    gt_sample.save()
                    break


        # iterating over several IoU threshold
        thresholds = [0.5, 0.75, 0.85]
        for threshold in thresholds:

            # constructing eval_key based on the threshold
            eval_key = f"IoU_{threshold}".replace(".", "_")

            # adding some eval information that will be visible as well
            results = gt_dataset.evaluate_detections(pred_field, 
                gt_field="segmentations", 
                eval_key=eval_key,
                iou=threshold,
                use_masks=True)
    
            # ious
            ious = results.ious
            # removing None values for predictions that did not match any instances
            filtered_ious = list(filter(lambda x: x is not None, ious))
            avg_iou_tps = sum(filtered_ious) / len(filtered_ious)
            avg_iou_all = sum(filtered_ious) / len(ious)
            print(f"avg_iou_tps: {round(avg_iou_tps, 2)}")
            print(f"avg_iou_all: {round(avg_iou_all, 2)}")

            # tp, fp, fn
            # this returns lists, one value for each sample
            tps = gt_dataset.values(eval_key + "_tp")
            fps = gt_dataset.values(eval_key + "_fp")
            fns = gt_dataset.values(eval_key + "_fn")

            # go through all samples and compute precision and recall
            for index in range(len(tps)):
                tp = tps[index]
                fp = fps[index]
                fn = fns[index]
                print(f"True positives: {tp}")
                print(f"False positives: {fp}")
                print(f"False negatives: {fn}")
                print(f"Instances identified: {tp + fp}")
                print(f"Instances in ground truth: {tp + fn}")

                # precision and recall
                precision = tp / (tp + fp)
                recall = tp  / (tp + fn)
                f1 = (2 * (precision * recall)) / (precision + recall)
                print(f"Precision @{threshold}: {round(precision, 2)}")
                print(f"Recall @{threshold}: {round(recall, 2)}")
                print(f"F1 score @{threshold}: {round(f1, 2)}")

        # starting a fiftyone session in a separate window to inspect the annotations
        session = fo.launch_app(gt_dataset)

        # waiting for the user to be done, then cleaning up
        input("Press enter when you're done inspecting the data:\n")
        session.close()
        os.remove(tmp_updated_annotations_path)

    else:
        print(f"Expected three arguments, but {len(argv)} were given.")
        return

if __name__ == "__main__":
   main(sys.argv[1:])