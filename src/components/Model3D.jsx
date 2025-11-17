import React, { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

const Model3D = ({ filePath }) => {
  const [error, setError] = useState(null);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {error ? (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100%', 
          color: '#ff6b6b',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div>⚠️</div>
          <div>Failed to load 3D model</div>
          <div style={{ fontSize: '12px', color: '#999' }}>{error}</div>
        </div>
      ) : (
        <Canvas>
          <PerspectiveCamera makeDefault position={[5, 5, 5]} />
          <OrbitControls 
            enableDamping
            dampingFactor={0.05}
            rotateSpeed={0.5}
            zoomSpeed={0.8}
          />
          
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <directionalLight position={[-10, -10, -5]} intensity={0.5} />
          
          <Suspense fallback={<Loader />}>
            <ModelLoader filePath={filePath} onError={setError} />
          </Suspense>
          
          <gridHelper args={[10, 10, '#444444', '#222222']} />
          <Environment preset="studio" />
        </Canvas>
      )}
    </div>
  );
};

const Loader = () => {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#00ff88" wireframe />
    </mesh>
  );
};

const ModelLoader = ({ filePath, onError }) => {
  const [model, setModel] = useState(null);

  useEffect(() => {
    if (!filePath) return;

    const loadModel = async () => {
      try {
        const ext = filePath.toLowerCase().split('.').pop();
        let loader;
        let loadedObject;

        if (ext === 'obj') {
          loader = new OBJLoader();
          const result = await window.electron.readFile(filePath);
          if (!result.success) {
            throw new Error(result.error);
          }
          
          const objText = atob(result.data);
          loadedObject = loader.parse(objText);
        } 
        else if (ext === 'gltf' || ext === 'glb') {
          loader = new GLTFLoader();
          const result = await window.electron.readFile(filePath);
          if (!result.success) {
            throw new Error(result.error);
          }
          
          const arrayBuffer = Uint8Array.from(atob(result.data), c => c.charCodeAt(0)).buffer;
          
          loadedObject = await new Promise((resolve, reject) => {
            loader.parse(
              arrayBuffer,
              '',
              (gltf) => resolve(gltf.scene),
              reject
            );
          });
        }
        else {
          throw new Error(`Unsupported file format: ${ext}`);
        }

        // Center and scale the model
        const box = new THREE.Box3().setFromObject(loadedObject);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 3 / maxDim;
        
        loadedObject.position.sub(center);
        loadedObject.scale.multiplyScalar(scale);
        
        // Apply default material if needed
        loadedObject.traverse((child) => {
          if (child.isMesh) {
            if (!child.material || child.material.length === 0) {
              child.material = new THREE.MeshStandardMaterial({
                color: 0xcccccc,
                metalness: 0.3,
                roughness: 0.7,
              });
            }
          }
        });

        setModel(loadedObject);
        onError(null);
      } catch (err) {
        console.error('Error loading model:', err);
        onError(err.message);
      }
    };

    loadModel();
  }, [filePath, onError]);

  return model ? <primitive object={model} /> : null;
};

export default Model3D;
