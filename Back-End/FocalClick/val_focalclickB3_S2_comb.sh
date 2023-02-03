# adapted from https://github.com/XavierCHEN34/ClickSEG/blob/main/trainval_scripts/val_focalclickB3_S2_comb.sh
python ./evaluate_model.py FocalClick\
  --model_dir=/exp/SEMI-AUTOMATIC-SEGMENTATION-TOOL/Back-End/FocalClick/models/focalclick/\
  --checkpoint=segformerB3_S2_comb.pth\
  --config-path=/exp/SEMI-AUTOMATIC-SEGMENTATION-TOOL/Back-End/FocalClick/config.yml\
  --infer-size=256\
  --datasets=WGISD\
  --gpus=0\
  --n-clicks=20\
  --target-iou=0.90