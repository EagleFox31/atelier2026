variable "compartment_id" {
  type        = string
  description = "OCID du compartment (souvent = tenancy OCID pour compte perso)"
}

variable "region" {
  type        = string
  description = "Region OCI home (ex: eu-paris-1, af-johannesburg-1)"
  default     = "eu-paris-1"
}

variable "project_name" {
  type    = string
  default = "atelier2026"
}

variable "ssh_public_key" {
  type        = string
  description = "Cle SSH publique (contenu de id_rsa.pub ou id_ed25519.pub)"
}

variable "admin_cidr" {
  type        = string
  description = "CIDR autorise pour SSH (ex: 203.0.113.10/32 — votre IP publique)"
  default     = "0.0.0.0/0"
}

variable "availability_domain" {
  type        = string
  description = "Laisser vide pour AD[0]. Si Out of capacity, essayer AD-2 ou AD-3 via terraform.tfvars"
  default     = ""
}

variable "ocpus" {
  type    = number
  default = 4
}

variable "memory_in_gbs" {
  type    = number
  default = 24
}

variable "boot_volume_size_in_gbs" {
  type    = number
  default = 50
}
