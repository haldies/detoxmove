import { requireNativeComponent } from 'react-native';

// Singleton: hanya register satu kali agar tidak crash
const NativeCameraView = requireNativeComponent<any>('NativeCameraView');

export default NativeCameraView;
