#cloud-config
package_update: true
package_upgrade: false

packages:
  - ca-certificates
  - curl
  - git
  - ufw

write_files:
  - path: /etc/motd.atelier
    content: |
      Atelier Maître — VM provisionnee par Terraform (OCI Always Free)
      Deploy : voir deploy/README.md dans le repo

runcmd:
  # Docker (Ubuntu 22.04)
  - curl -fsSL https://get.docker.com | sh
  - systemctl enable docker
  - systemctl start docker
  - usermod -aG docker ubuntu
  # Compose plugin
  - mkdir -p /usr/local/lib/docker/cli-plugins
  - curl -SL "https://github.com/docker/compose/releases/download/v2.32.4/docker-compose-linux-aarch64" -o /usr/local/lib/docker/cli-plugins/docker-compose
  - chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
  - ln -sf /usr/local/lib/docker/cli-plugins/docker-compose /usr/local/bin/docker-compose
  # Repertoire app
  - mkdir -p /opt/${project_name}
  - chown ubuntu:ubuntu /opt/${project_name}
  # Firewall basique (SSH deja ouvert via OCI security list)
  - ufw allow 80/tcp
  - ufw allow 443/tcp
  - ufw --force enable

final_message: "Cloud-init termine — pret pour deploy/scripts/remote-deploy.sh"
