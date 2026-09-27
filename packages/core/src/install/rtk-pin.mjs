/**
 * The RTK release this toolbox is tested with. install.sh, `tech-lead-stack
 * init` and `doctor` all read it from here.
 *
 * The installer script is pinned to the release tag's commit and hash-checked
 * before it runs; RTK_VERSION pins the binary it downloads, which the
 * installer checksum-verifies itself. To upgrade RTK, change all three
 * together.
 */
export const RTK_VERSION = 'v0.50.0';
export const RTK_INSTALLER_URL =
  'https://raw.githubusercontent.com/rtk-ai/rtk/1d87b8e719ce0a50c223cd93ca64dd16921f9aec/install.sh';
export const RTK_INSTALLER_SHA256 =
  'd6eb73a772903e13ff34ee1be8a8b24e896ba9a978f20d2279a08b4083ea6f77';
