declare module 'react-native-activity-recognition' {
  export interface Activity {
    type: 'IN_VEHICLE' | 'ON_BICYCLE' | 'ON_FOOT' | 'RUNNING' | 'STILL' | 'TILTING' | 'UNKNOWN' | 'WALKING';
    confidence: number;
  }

  export default class ActivityRecognition {
    static start(interval: number): void;
    static stop(): void;
    static subscribe(callback: (activities: Activity[]) => void): void;
  }
}
