import React, { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';

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
        <Canvas gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
          <PerspectiveCamera makeDefault position={[5, 5, 5]} />
          <OrbitControls 
            enableDamping
            dampingFactor={0.05}
            rotateSpeed={0.5}
            zoomSpeed={0.8}
          />
          
          {/* Strong ambient light for base illumination */}
          <ambientLight intensity={1.5} />
          
          {/* Main directional light (sun) */}
          <directionalLight 
            position={[10, 15, 10]} 
            intensity={2.5} 
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          
          {/* Fill lights from different angles */}
          <directionalLight position={[-10, 10, -5]} intensity={1.5} />
          <directionalLight position={[0, -10, 10]} intensity={0.8} />
          
          {/* Point lights for more even illumination */}
          <pointLight position={[10, 10, 10]} intensity={1} />
          <pointLight position={[-10, 10, -10]} intensity={0.8} />
          
          {/* Hemisphere light for natural sky/ground lighting */}
          <hemisphereLight args={['#ffffff', '#444444', 1.2]} />
          
          <Suspense fallback={<Loader />}>
            <ModelLoader filePath={filePath} onError={setError} />
          </Suspense>
          
          <gridHelper args={[10, 10, '#444444', '#222222']} />
          <Environment preset="studio" background={false} />
        </Canvas>
      )}
    </div>
  );
};

const Loader = () => {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="hsla(111, 67%, 29%, 1.00)" wireframe />
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
        else if (ext === 'fbx') {
          loader = new FBXLoader();
          const result = await window.electron.readFile(filePath);
          if (!result.success) {
            throw new Error(result.error);
          }
          
          const arrayBuffer = Uint8Array.from(atob(result.data), c => c.charCodeAt(0)).buffer;
          
          loadedObject = await new Promise((resolve, reject) => {
            try {
              const fbx = loader.parse(arrayBuffer, '');
              resolve(fbx);
            } catch (err) {
              reject(err);
            }
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
        
        // Fix materials for proper lighting response
        loadedObject.traverse((child) => {
          if (child.isMesh) {
            // Ensure mesh can receive and cast shadows
            child.castShadow = true;
            child.receiveShadow = true;
            
            if (!child.material || child.material.length === 0) {
              // Apply default material if none exists
              child.material = new THREE.MeshStandardMaterial({
                color: 0xcccccc,
                metalness: 0.3,
                roughness: 0.7,
              });
            } else {
              // Fix existing materials for better lighting
              const materials = Array.isArray(child.material) ? child.material : [child.material];
              materials.forEach((mat) => {
                if (mat) {
                  // Ensure material responds to lights
                  mat.needsUpdate = true;
                  
                  // If it's a basic material, convert to standard for proper lighting
                  if (mat.isMeshBasicMaterial) {
                    const newMat = new THREE.MeshStandardMaterial({
                      color: mat.color,
                      map: mat.map,
                      metalness: 0.2,
                      roughness: 0.8,
                    });
                    child.material = newMat;
                  }
                  // Fix MeshPhongMaterial and MeshStandardMaterial
                  else if (mat.isMeshPhongMaterial || mat.isMeshStandardMaterial) {
                    // Ensure reasonable metalness/roughness for FBX
                    if (mat.metalness !== undefined && mat.metalness > 0.9) {
                      mat.metalness = 0.5;
                    }
                    if (mat.roughness !== undefined && mat.roughness < 0.1) {
                      mat.roughness = 0.4;
                    }
                  }
                  // Convert Lambert to Standard for better lighting
                  else if (mat.isMeshLambertMaterial) {
                    const newMat = new THREE.MeshStandardMaterial({
                      color: mat.color,
                      map: mat.map,
                      emissive: mat.emissive,
                      emissiveMap: mat.emissiveMap,
                      metalness: 0.1,
                      roughness: 0.9,
                    });
                    child.material = newMat;
                  }
                }
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
