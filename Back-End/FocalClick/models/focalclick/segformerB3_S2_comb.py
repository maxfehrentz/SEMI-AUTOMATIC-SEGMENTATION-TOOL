# adapted from https://github.com/XavierCHEN34/ClickSEG/blob/main/models/focalclick/segformerB3_S2_comb.py

from isegm.utils.exp_imports.default import *
from isegm.data.datasets.coco import CocoDataset
from isegm.data.aligned_augmentation import AlignedAugmentator
from isegm.engine.focalclick_trainer import ISTrainer
import torch.nn as nn

import optuna
from optuna.trial import TrialState
import optuna.visualization

import os


MODEL_NAME = 'segformerB3_S2_comb'

def main(cfg):
    model_cfg = init_model()
    finetune(cfg, model_cfg)


def init_model():
    model_cfg = edict()
    model_cfg.crop_size = (256, 256)
    model_cfg.num_max_points = 24
    return model_cfg

def finetune(cfg, model_cfg):
    # setting the weight config with the path provided in the config file
    cfg.weights = cfg.SEGFORMER_B3

    cfg.batch_size = 28 if cfg.batch_size < 1 else cfg.batch_size
    cfg.val_batch_size = cfg.batch_size
    crop_size = model_cfg.crop_size

    loss_cfg = edict()

    # corresponds to sigmoid of L_nfl from paper; supervises coarse segmentation
    loss_cfg.instance_loss = NormalizedFocalLossSigmoid(alpha=0.5, gamma=2)
    loss_cfg.instance_loss_weight = 1.0

    # corresponds to L_bnfl from paper; supervises refinement
    loss_cfg.instance_refine_loss = WFNL(alpha=0.5, gamma=2, w=0.5)
    loss_cfg.instance_refine_loss_weight = 1.0

    # corresponds to L_bce from paper; supervises boundary head with standard BCE
    loss_cfg.trimap_loss = nn.BCEWithLogitsLoss() #NormalizedFocalLossSigmoid(alpha=0.5, gamma=2)
    loss_cfg.trimap_loss_weight = 1.0
    

    color_augmentator = Compose([
        RandomBrightnessContrast(brightness_limit=(-0.25, 0.25), contrast_limit=(-0.15, 0.4), p=0.75),
        RGBShift(r_shift_limit=10, g_shift_limit=10, b_shift_limit=10, p=0.75)
    ], p=1.0)

    train_augmentator = AlignedAugmentator(ratio=[0.5,1.3], target_size=crop_size,flip=True, distribution='Gaussian', gs_center=1, color_augmentator=color_augmentator)

    val_augmentator = Compose([
        UniformRandomResize(scale_range=(0.75, 1.25)),
        PadIfNeeded(min_height=crop_size[0], min_width=crop_size[1], border_mode=0),
        RandomCrop(*crop_size)
    ], p=1.0)

    points_sampler = MultiPointSampler(model_cfg.num_max_points, prob_gamma=0.80,
                                       merge_objects_prob=0.15,
                                       max_num_merged_objects=2,
                                       use_hierarchy=False,
                                       first_click_center=True)

    # the path to trainset and valset is the same PATH because the data will be loaded differentiated by the split argument
    trainset_coco = CocoDataset(
        cfg.RED_GLOBE_TRAIN_VAL,
        split='train',
        augmentator=train_augmentator,
        min_object_area=1000,
        keep_background_prob=0.05,
        points_sampler=points_sampler,
        epoch_len=500,
        stuff_prob=0.1
    )

    valset = CocoDataset(
        cfg.REG_GLOBE_TRAIN_VAL,
        split='val',
        augmentator=val_augmentator,
        min_object_area=1000,
        points_sampler=points_sampler,
        epoch_len=32
    )

    trainer = ISTrainer(cfg, model_cfg, loss_cfg,
                        trainset_coco, valset,
                        checkpoint_interval=10,
                        image_dump_interval=500,
                        metrics=[AdaptiveIoU()],
                        max_interactive_points=model_cfg.num_max_points,
                        max_num_next_clicks=3)

    # using Optuna trick as suggested here: https://www.kaggle.com/general/261870
    func = lambda trial: trainer.objective(trial, num_epochs = 300)

    # TODO: first trial, take out early stopping, high epochs, 20-25 n_trials
    # starting hyperparameter search
    study = optuna.create_study(direction = 'minimize')
    study.optimize(func, n_trials = 5)

    # taken from https://github.com/optuna/optuna-examples/blob/main/pytorch/pytorch_simple.py
    pruned_trials = study.get_trials(deepcopy=False, states=[TrialState.PRUNED])
    complete_trials = study.get_trials(deepcopy=False, states=[TrialState.COMPLETE])

    # saving opuna output
    summary_path = os.path.abspath(cfg.OPTUNA_SUM_PATH)
    if not os.path.isdir(summary_path):
        os.makedirs(summary_path)
    with open(os.path.join(summary_path, "summary.txt"), 'w') as sum_file:

        sum_file.write("Study statistics: \n")
        sum_file.write(f"  Number of finished trials: {len(study.trials)}\n")
        sum_file.write(f"  Number of pruned trials: {len(pruned_trials)}\n")
        sum_file.write(f"  Number of complete trials: {len(complete_trials)}\n")

        sum_file.write("Best trial:\n")
        trial = study.best_trial

        sum_file.write(f"  Value: {trial.value}")

        sum_file.write("  Params: \n")
        for key, value in trial.params.items():
            sum_file.write("    {}: {}\n".format(key, value))

    # visualization
    vis_path = os.path.abspath(cfg.OPTUNA_VIS_PATH)
    if not os.path.isdir(vis_path):
        os.makedirs(vis_path)

    fig = optuna.visualization.plot_contour(study)
    fig.write_image(os.path.join(vis_path, "contour.png"))

    fig = optuna.visualization.plot_intermediate_values(study)
    fig.write_image(os.path.join(vis_path, "intermediate_values.png"))

    fig = optuna.visualization.plot_parallel_coordinate(study)
    fig.write_image(os.path.join(vis_path, "parallel_coordinate.png"))

    fig = optuna.visualization.plot_param_importances(study)
    fig.write_image(os.path.join(vis_path, "param_importance.png"))

    # fig = optuna.visualization.plot_pareto_front(study)
    # fig.write_image(os.path.join(vis_path, "pareto_front"), format="png")

    fig = optuna.visualization.plot_slice(study)
    fig.write_image(os.path.join(vis_path, "slice_plot.png"))
