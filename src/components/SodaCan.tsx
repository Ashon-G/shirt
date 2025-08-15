"use client";

import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import { useLoader, useThree } from "@react-three/fiber";
import SplineLoader from "@splinetool/loader";
import * as THREE from "three";
import { useEffect } from "react";

export type SodaCanProps = {
  scale?: number;
};

export function SodaCan({ scale = 2, ...props }: SodaCanProps) {
  const splineScene = useLoader(
    SplineLoader,
    "https://prod.spline.design/PDPpJC3z1w9z6ds3/scene.splinecode",
  );
  const { camera, size, gl, scene } = useThree();

  useEffect(() => {
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFShadowMap;
    scene.background = new THREE.Color("#18181a");
    gl.setClearAlpha(0);
  }, [gl, scene]);

  useEffect(() => {
    if (camera instanceof THREE.OrthographicCamera) {
      camera.left = size.width / -2;
      camera.right = size.width / 2;
      camera.top = size.height / 2;
      camera.bottom = size.height / -2;
      camera.updateProjectionMatrix();
    }
  }, [camera, size]);

  return (
    <group {...props} scale={scale}>
      <OrthographicCamera
        makeDefault
        position={[0, 0, 0]}
        near={-50000}
        far={10000}
      />
      <primitive object={splineScene} />
      <OrbitControls enableDamping dampingFactor={0.125} />
    </group>
  );
}

SodaCan.displayName = "SodaCan";

