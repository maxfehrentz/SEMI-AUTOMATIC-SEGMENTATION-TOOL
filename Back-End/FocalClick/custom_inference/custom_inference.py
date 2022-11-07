import ../isegm/inference/predictors/__init__
import ../isegm/inference/focalclick
import ../isegm/model/is_segformer_model
import ../models/focalclick/hrnet18s_S1_cclvs

# adapted from evaluation.py
def get_mask_for_click(x, y, typeOfClick) {
    # TODO: implement
    return
}

def evaluate_sample(image, gt_mask, init_mask, predictor, max_iou_thr,
                    pred_thr=0.49, min_clicks=1, max_clicks=20,
                    sample_id=None, vis = True, save_dir = None, index = 0,  callback=None,
                    progressive_mode = True,
                    ):
    clicker = Clicker(gt_mask=gt_mask)
    pred_mask = np.zeros_like(gt_mask)
    prev_mask = pred_mask
    ious_list = []

    with torch.no_grad():
        predictor.set_input_image(image)
        if init_mask is not None:
            predictor.set_prev_mask(init_mask)
            pred_mask = init_mask
            prev_mask = init_mask
            num_pm = 0
        else:
            num_pm = 999
            
        for click_indx in range(max_clicks):
            vis_pred = prev_mask
            clicker.make_next_click(pred_mask)
            pred_probs = predictor.get_prediction(clicker)
            pred_mask = pred_probs > pred_thr

            if progressive_mode:
                clicks = clicker.get_clicks()
                if len(clicks) >= num_pm: 
                    last_click = clicks[-1]
                    last_y, last_x = last_click.coords[0], last_click.coords[1]
                    pred_mask = Progressive_Merge(pred_mask, prev_mask,last_y, last_x)
                    predictor.transforms[0]._prev_probs = np.expand_dims(np.expand_dims(pred_mask,0),0)
            if callback is not None:
                callback(image, gt_mask, pred_probs, sample_id, click_indx, clicker.clicks_list)

            iou = utils.get_iou(gt_mask, pred_mask)
            ious_list.append(iou)
            prev_mask = pred_mask

            if iou >= max_iou_thr and click_indx + 1 >= min_clicks:
                break

        if vis:
            if predictor.focus_roi is not None:
                focus_roi = predictor.focus_roi
                global_roi = predictor.global_roi
                clicks_list = clicker.get_clicks()
                last_y, last_x = predictor.last_y, predictor.last_x
                focus_refined = predictor.focus_refined
                focus_coarse = predictor.focus_coarse

                out_image, focus_image = vis_result_refine(image, pred_mask, gt_mask, init_mask, iou,click_indx+1,clicks_list,focus_roi, global_roi, vis_pred, last_y, last_x, focus_refined, focus_coarse)
                cv2.imwrite(save_dir+str(index)+'.png', out_image)
                cv2.imwrite(save_dir+str(index)+'_focus.png', focus_image)
                
            else:
                clicks_list = clicker.get_clicks()
                last_y, last_x = predictor.last_y, predictor.last_x
                out_image = vis_result_base(image, pred_mask, gt_mask, init_mask, iou,click_indx+1,clicks_list, vis_pred, last_y, last_x)
                cv2.imwrite(save_dir+str(index)+'.png', out_image)
        return clicker.clicks_list, np.array(ious_list, dtype=np.float32), pred_probs