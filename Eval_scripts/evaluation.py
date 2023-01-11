from pycocotools.coco import COCO
from pycocotools.cocoeval import COCOeval

import sys, os

__all__ = ['COCOEvaluator']

# evaluator class adapted from https://github.com/cocodataset/cocoapi/issues/426
class COCOEvaluator(object):

    def __init__(self, anno_gt_file, anno_dt_file):
        self.coco_gt = COCO(anno_gt_file)
        self.coco_dt = COCO(anno_dt_file)
        self._hack_coco_dt()

    # TODO: figure out why this hack is necessary
    def _hack_coco_dt(self):
        for ann in self.coco_dt.dataset['annotations']:
            ann['score'] = 1.0

    def evaluate(self, iou_type='bbox'):
        coco_eval = COCOeval(self.coco_gt, self.coco_dt, iou_type)
        # TODO: figure out how this works exactly and how to interpret the outputs
        coco_eval.evaluate()
        coco_eval.accumulate()
        coco_eval.summarize()

        return coco_eval

def main(argv):
    # first argument should be the ground truth file
    gt_file = argv[0]

    eval_results = dict()

    if os.path.isfile(gt_file):
        # args[1:] contains the remaining paths
        for file_path in argv[1:]:
            if os.path.isfile(file_path):
                evaluator = COCOEvaluator(gt_file, file_path)
                evaluation = evaluator.evaluate("segm")
                eval_results[file_path] = evaluation
            else:
                print(f"{path} does not lead to a file and could not be compared to the ground truth.")
    else:
        print(f"The passed path {gt_file} for the ground truth does not lead to a file.")

    print(f"final result: {eval_results}")

    return


if __name__ == "__main__":
   main(sys.argv[1:])