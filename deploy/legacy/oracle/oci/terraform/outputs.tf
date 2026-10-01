output "public_ip" {
  description = "IP publique de la VM — ouvrir http://IP dans le browser"
  value       = data.oci_core_vnic.app_vnic.public_ip_address
}

output "ssh_user" {
  value = "ubuntu"
}

output "ssh_command" {
  value = "ssh ubuntu@${data.oci_core_vnic.app_vnic.public_ip_address}"
}

output "instance_ocid" {
  value = oci_core_instance.app.id
}

output "next_steps" {
  value = <<-EOT
    1. cp deploy/.env.prod.example deploy/.env.prod  (DATABASE_URL, DIRECT_URL, JWT_SECRET, ALLOWED_ORIGINS=http://${data.oci_core_vnic.app_vnic.public_ip_address})
    2. npx prisma db seed  (depuis votre PC — comptes test)
    3. ./deploy/scripts/remote-deploy.sh ubuntu@${data.oci_core_vnic.app_vnic.public_ip_address}
    4. Ouvrir http://${data.oci_core_vnic.app_vnic.public_ip_address} — login admin@atelier.cm / Atelier2026!
  EOT
}
