export type Track = 'Performance track' | 'Access control track' | 'High assurance track' | 'ML inside track';

export interface TrackSelection {
    plannedTracks: Track[];
}

export interface PackageData {
  Name: string;
  Content?: string;
  URL?: string;
  debloat?: boolean;
  JSProgram?: string; 
}

export interface PackageMetadata {
  Name: string;
  Version: string;
  ID: string;
}

export interface Package {
  metadata: PackageMetadata;
  data: PackageData;
}

export interface PackageCost {
  standaloneCost: number;
  totalCost: number;
}

interface VersionInfo {
    version: string;
    packageId: string;
    timestamp: string;
    URL?: string;
}

interface PackageInfo {
    versions: VersionInfo[];
}

export interface PackageIndex {
    packages: {
        [key: string]: PackageInfo;
    };
}