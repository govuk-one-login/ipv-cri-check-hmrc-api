terraform {
  required_providers {
    sops = {
      source = "carlpett/sops"
      version = "= 1.1.1"
    }
    aws = {
      source = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

data "sops_file" "primary" {
  source_file = "secrets.yaml"
}

locals {
  secrets_primary = yamldecode(data.sops_file.primary.raw)
}

resource "aws_secretsmanager_secret" "example_secret" {
  name = "Example"
}

resource "aws_secretsmanager_secret_version" "example_secret_version" {
  secret_id = aws_secretsmanager_secret.example_secret.id
  secret_string = local.secrets_primary.Example
}

output "example_secret_arn" {
  value = aws_secretsmanager_secret.example_secret.arn
}
