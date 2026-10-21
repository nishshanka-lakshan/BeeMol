# Training preparation

example.jsonl is ONE synthetic format example, not a usable training corpus. Do not claim a trained model from this package.

Create expert-reviewed cases with messages, case_id and group_id. Keep all related runs for a molecule/calculation family in the same split. Preserve units, method, basis, initial coefficients and provenance. Remove private data you do not have permission to use. Include insufficient-evidence cases and errors. Evaluate unit accuracy, extracted values, numerical consistency and unsupported claims on held-out cases.

Training is provider/model specific. This package intentionally does not submit a paid job or guess an unselected model's training commands. Export the messages field into the selected trainer's required schema. Train and evaluate a supported base model or adapter, then deploy it behind a chat-completions endpoint. Set BEEMOL_MODEL to the deployed model identifier. The backend is identical for pretrained and fine-tuned models.

No automatic training on uploaded data, persistence of prompts, model weights, GPU training, preference optimization or model-quality certification is included.
