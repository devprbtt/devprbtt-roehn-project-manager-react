# Roehn-Automacao Home Assistant Add-on

This document explains how to install the Roehn-Automacao application as a local add-on in your Home Assistant instance.

## Prerequisites

- You must have a working Home Assistant installation.
- You need a way to access the Home Assistant file system. The easiest way is by installing and configuring one of the following add-ons:
  - **Samba share**: Allows you to access the configuration files from another computer on your network.
  - **Advanced SSH & Web Terminal**: Allows you to access the file system via an SSH connection.

## Installation Instructions

1.  **Copy the Add-on Folder**:
    - The entire contents of this `hassio_addon` directory need to be copied into the `/addons` directory of your Home Assistant installation.
    - Connect to your Home Assistant instance using Samba or SSH.
    - Navigate to the root of your Home Assistant configuration (where you see `configuration.yaml`).
    - If it doesn't already exist, create a new folder named `addons`.
    - Copy the `hassio_addon` directory into the `addons` folder. You can rename `hassio_addon` to something more descriptive, like `roehn_automacao`, if you wish. The name of the folder inside `/addons` will be the slug of your local add-on.

    After copying, your directory structure should look like this:
    ```
    /addons
    └── roehn_automacao/
        ├── Dockerfile
        ├── build.yaml
        ├── config.yaml
        ├── run.sh
        └── ... (other files)
    ```

2.  **Install the Add-on in Home Assistant**:
    - In your Home Assistant UI, navigate to **Settings > Add-ons**.
    - In the bottom right corner, click on the **Add-on Store** button.
    - In the top right corner, click the three-dots menu and select **Check for updates**. This will force Home Assistant to look for new add-ons.
    - You should now see a new section at the top of the store called **Local add-ons**. The "Roehn-Automacao" add-on will be listed there.
    - Click on the "Roehn-Automacao" add-on card to open its details page.

3.  **Build and Start the Add-on**:
    - On the add-on details page, click the **Install** button. This will trigger Home Assistant to build the Docker image based on the provided files. This process may take several minutes.
    - Once the installation is complete, you can configure any options (if available) and then click **Start**.
    - You can monitor the add-on's logs by navigating to the **Log** tab on the add-on's page.

4.  **Access the Application**:
    - If the add-on starts successfully, you will find a new item labeled "Roehn-Automacao" in your Home Assistant sidebar.
    - Clicking on it will open the application's user interface directly inside Home Assistant, thanks to the Ingress feature.

You're all set! The application is now running as a fully integrated Home Assistant add-on.
