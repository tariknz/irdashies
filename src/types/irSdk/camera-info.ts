export interface Camera {
  CameraNum: number;
  CameraName: string;
}

export interface CameraGroup {
  GroupNum: number;
  GroupName: string;
  IsScenic?: boolean;
  Cameras: Camera[];
}

export interface CameraInfo {
  Groups: CameraGroup[];
}
