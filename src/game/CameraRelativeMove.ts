/**
 * Rotates a raw {x,z} move-input vector into world space relative to the
 * camera's current orbit yaw. At yaw=0 (today's default camera angle,
 * camera behind the player looking toward -Z), forward input (z=1) must
 * map to world -Z — the direction the camera is actually looking, not the
 * raw +Z the old world-space-only movement used.
 */
export function toCameraRelative(inputX: number, inputZ: number, cameraYaw: number): { x: number; z: number } {
  const sin = Math.sin(cameraYaw);
  const cos = Math.cos(cameraYaw);
  return {
    x: inputX * cos - inputZ * sin,
    z: -inputX * sin - inputZ * cos,
  };
}
