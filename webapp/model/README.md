# AI Model Weights Directory

This directory stores PyTorch trained model weights (`.pth`) for the Deepfake Detection System.

Due to file size constraints (>100 MB), pre-trained weight files are excluded from this repository via `.gitignore`.

### Supported Models in System:
- `xception_Deepfakes.pth`
- `xception_Face2Face.pth`
- `xception_FaceShifter.pth`
- `xception_NeuralTextures.pth`
- `best_wild_deepfake_xception.pth`
- `xception_deepfake_2.pth`

### Backbone Architecture:
- **Base Architecture**: Xception (Extreme Inception) via `timm` / PyTorch
- **Input Resolution**: 299 × 299 × 3
- **Face Extraction**: MTCNN (Multi-task Cascaded Convolutional Networks)
