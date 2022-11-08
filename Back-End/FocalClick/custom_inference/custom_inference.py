import os
import sys
sys.path.append(os.path.relpath("../FocalClick/isegm/inference/predictors"))
import __init__
import focalclick
sys.path.append(os.path.relpath("../FocalClick/isegm/model"))
import is_segformer_model
sys.path.append(os.path.relpath("../FocalClick/models/focalclick"))
import hrnet18s_S1_cclvs

import numpy as np
import torch

def compute_mask(image, clicks, prev_mask, predictor,
                    pred_thr=0.49
                    ):

    progressive_mode = True

    # prev_mask:
    # 

    # TODO: figure out a way to do this; probably just np.array filled with zeros of the same dimension as the image
    pred_mask = np.zeros_like(gt_mask)

    if prev_mask is None:
        prev_mask = pred_mask

    with torch.no_grad():
        predictor.set_input_image(image)
        predictor.set_prev_mask(init_mask)
            
        # TODO: adapt code in get_prediction
        pred_probs = predictor.get_prediction(clicks)
        pred_mask = pred_probs > pred_thr
        if progressive_mode:
            last_click = clicks[-1]
            last_x, last_y = last_click.coords[0], last_click.coords[1]
            pred_mask = Progressive_Merge(pred_mask, prev_mask, last_y, last_x)
            predictor.transforms[0]._prev_probs = np.expand_dims(np.expand_dims(pred_mask,0),0)
            # if callback is not None:
            #     callback(image, gt_mask, pred_probs, sample_id, click_indx, clicker.clicks_list)

            # iou = utils.get_iou(gt_mask, pred_mask)
            # ious_list.append(iou)
            # prev_mask = pred_mask

            # if iou >= max_iou_thr and click_indx + 1 >= min_clicks:
            #     break

        # if vis:
        #     if predictor.focus_roi is not None:
        #         focus_roi = predictor.focus_roi
        #         global_roi = predictor.global_roi
        #         clicks_list = clicker.get_clicks()
        #         last_y, last_x = predictor.last_y, predictor.last_x
        #         focus_refined = predictor.focus_refined
        #         focus_coarse = predictor.focus_coarse

        #         out_image, focus_image = vis_result_refine(image, pred_mask, gt_mask, init_mask, iou,click_indx+1,clicks_list,focus_roi, global_roi, vis_pred, last_y, last_x, focus_refined, focus_coarse)
        #         cv2.imwrite(save_dir+str(index)+'.png', out_image)
        #         cv2.imwrite(save_dir+str(index)+'_focus.png', focus_image)
                
        #     else:
        #         clicks_list = clicker.get_clicks()
        #         last_y, last_x = predictor.last_y, predictor.last_x
        #         out_image = vis_result_base(image, pred_mask, gt_mask, init_mask, iou,click_indx+1,clicks_list, vis_pred, last_y, last_x)
        #         cv2.imwrite(save_dir+str(index)+'.png', out_image)
        return pred_mask