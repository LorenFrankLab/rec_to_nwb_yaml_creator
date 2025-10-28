import { describe, it, expect } from 'vitest';
import {
  formatElectrodeGroupLabel,
  formatCameraLabel,
  formatTaskLabel,
  formatBehavioralEventLabel,
  formatDataAcqDeviceLabel,
  formatAssociatedFileLabel,
  formatAssociatedVideoLabel,
  formatOptoSourceLabel,
  formatOpticalFiberLabel,
  formatVirusInjectionLabel,
  formatFsGuiLabel,
} from '../labelFormatters';

describe('labelFormatters', () => {
  describe('formatElectrodeGroupLabel', () => {
    it('formats electrode group with id only (location not shown)', () => {
      expect(formatElectrodeGroupLabel({ id: 0, location: 'CA1' }))
        .toBe('Electrode Group 0');

      expect(formatElectrodeGroupLabel({ id: 5, location: 'CA3' }))
        .toBe('Electrode Group 5');
    });

    it('handles missing location (not displayed anyway)', () => {
      expect(formatElectrodeGroupLabel({ id: 1, location: '' }))
        .toBe('Electrode Group 1');
    });

    it('handles null location (not displayed anyway)', () => {
      expect(formatElectrodeGroupLabel({ id: 1, location: null }))
        .toBe('Electrode Group 1');
    });

    it('handles undefined location (not displayed anyway)', () => {
      expect(formatElectrodeGroupLabel({ id: 1 }))
        .toBe('Electrode Group 1');
    });

    it('handles complex location names (not displayed in navigation)', () => {
      expect(formatElectrodeGroupLabel({ id: 2, location: 'alveus of the hippocampus (alv)' }))
        .toBe('Electrode Group 2');
    });

    it('handles numeric id of zero', () => {
      expect(formatElectrodeGroupLabel({ id: 0, location: 'DG' }))
        .toBe('Electrode Group 0');
    });
  });

  describe('formatCameraLabel', () => {
    it('formats complete camera with id and name', () => {
      expect(formatCameraLabel({ id: 1, camera_name: 'MainCamera' }))
        .toBe('Camera 1 - MainCamera');

      expect(formatCameraLabel({ id: 0, camera_name: 'overhead' }))
        .toBe('Camera 0 - overhead');
    });

    it('handles missing camera_name with "Unnamed" fallback', () => {
      expect(formatCameraLabel({ id: 1, camera_name: '' }))
        .toBe('Camera 1 - Unnamed');
    });

    it('handles null camera_name', () => {
      expect(formatCameraLabel({ id: 1, camera_name: null }))
        .toBe('Camera 1 - Unnamed');
    });

    it('handles undefined camera_name', () => {
      expect(formatCameraLabel({ id: 1 }))
        .toBe('Camera 1 - Unnamed');
    });

    it('handles long camera names', () => {
      expect(formatCameraLabel({ id: 2, camera_name: 'behavioral_video_side_angle_camera' }))
        .toBe('Camera 2 - behavioral_video_side_angle_camera');
    });
  });

  describe('formatTaskLabel', () => {
    it('formats complete task with name', () => {
      expect(formatTaskLabel({ task_name: 'linear track' }))
        .toBe('Task: linear track');

      expect(formatTaskLabel({ task_name: 'sleep' }))
        .toBe('Task: sleep');
    });

    it('handles missing task_name with "Unnamed" fallback', () => {
      expect(formatTaskLabel({ task_name: '' }))
        .toBe('Task: Unnamed');
    });

    it('handles null task_name', () => {
      expect(formatTaskLabel({ task_name: null }))
        .toBe('Task: Unnamed');
    });

    it('handles undefined task_name', () => {
      expect(formatTaskLabel({}))
        .toBe('Task: Unnamed');
    });

    it('handles complex task names', () => {
      expect(formatTaskLabel({ task_name: '8-arm radial maze exploration phase 2' }))
        .toBe('Task: 8-arm radial maze exploration phase 2');
    });
  });

  describe('formatBehavioralEventLabel', () => {
    it('formats complete behavioral event with name', () => {
      expect(formatBehavioralEventLabel({ name: 'reward' }))
        .toBe('Event: reward');

      expect(formatBehavioralEventLabel({ name: 'light1' }))
        .toBe('Event: light1');
    });

    it('handles missing name with "Unnamed" fallback', () => {
      expect(formatBehavioralEventLabel({ name: '' }))
        .toBe('Event: Unnamed');
    });

    it('handles null name', () => {
      expect(formatBehavioralEventLabel({ name: null }))
        .toBe('Event: Unnamed');
    });

    it('handles undefined name', () => {
      expect(formatBehavioralEventLabel({}))
        .toBe('Event: Unnamed');
    });
  });

  describe('formatDataAcqDeviceLabel', () => {
    it('formats complete device with name', () => {
      expect(formatDataAcqDeviceLabel({ name: 'SpikeGadgets' }))
        .toBe('Device: SpikeGadgets');

      expect(formatDataAcqDeviceLabel({ name: 'Device1' }))
        .toBe('Device: Device1');
    });

    it('handles missing name with "Unnamed" fallback', () => {
      expect(formatDataAcqDeviceLabel({ name: '' }))
        .toBe('Device: Unnamed');
    });

    it('handles null name', () => {
      expect(formatDataAcqDeviceLabel({ name: null }))
        .toBe('Device: Unnamed');
    });

    it('handles undefined name', () => {
      expect(formatDataAcqDeviceLabel({}))
        .toBe('Device: Unnamed');
    });
  });

  describe('formatAssociatedFileLabel', () => {
    it('formats complete file with name', () => {
      expect(formatAssociatedFileLabel({ name: 'experiment_metadata.yml' }))
        .toBe('File: experiment_metadata.yml');

      expect(formatAssociatedFileLabel({ name: 'protocol.txt' }))
        .toBe('File: protocol.txt');
    });

    it('handles missing name with "Unnamed" fallback', () => {
      expect(formatAssociatedFileLabel({ name: '' }))
        .toBe('File: Unnamed');
    });

    it('handles null name', () => {
      expect(formatAssociatedFileLabel({ name: null }))
        .toBe('File: Unnamed');
    });

    it('handles undefined name', () => {
      expect(formatAssociatedFileLabel({}))
        .toBe('File: Unnamed');
    });

    it('handles long filenames with paths', () => {
      expect(formatAssociatedFileLabel({ name: '/path/to/very/long/experiment_metadata_session_20240115.yml' }))
        .toBe('File: /path/to/very/long/experiment_metadata_session_20240115.yml');
    });
  });

  describe('formatAssociatedVideoLabel', () => {
    it('formats complete video with name', () => {
      expect(formatAssociatedVideoLabel({ name: 'behavior_cam.mp4' }))
        .toBe('Video: behavior_cam.mp4');

      expect(formatAssociatedVideoLabel({ name: 'overhead_tracking.avi' }))
        .toBe('Video: overhead_tracking.avi');
    });

    it('handles missing name with "Unnamed" fallback', () => {
      expect(formatAssociatedVideoLabel({ name: '' }))
        .toBe('Video: Unnamed');
    });

    it('handles null name', () => {
      expect(formatAssociatedVideoLabel({ name: null }))
        .toBe('Video: Unnamed');
    });

    it('handles undefined name', () => {
      expect(formatAssociatedVideoLabel({}))
        .toBe('Video: Unnamed');
    });
  });

  describe('formatOptoSourceLabel', () => {
    it('formats complete source with name and wavelength', () => {
      expect(formatOptoSourceLabel({ name: 'LaserDiode', wavelength_in_nm: 473 }))
        .toBe('Source: LaserDiode - 473nm');

      expect(formatOptoSourceLabel({ name: 'LED1', wavelength_in_nm: 590 }))
        .toBe('Source: LED1 - 590nm');
    });

    it('omits wavelength when missing', () => {
      expect(formatOptoSourceLabel({ name: 'LED1' }))
        .toBe('Source: LED1');
    });

    it('omits wavelength when null', () => {
      expect(formatOptoSourceLabel({ name: 'LED1', wavelength_in_nm: null }))
        .toBe('Source: LED1');
    });

    it('omits wavelength when undefined', () => {
      expect(formatOptoSourceLabel({ name: 'LED1', wavelength_in_nm: undefined }))
        .toBe('Source: LED1');
    });

    it('omits wavelength when zero (falsy)', () => {
      expect(formatOptoSourceLabel({ name: 'LED1', wavelength_in_nm: 0 }))
        .toBe('Source: LED1');
    });

    it('handles missing name with "Unnamed" fallback', () => {
      expect(formatOptoSourceLabel({ name: '', wavelength_in_nm: 473 }))
        .toBe('Source: Unnamed - 473nm');
    });

    it('handles both name and wavelength missing', () => {
      expect(formatOptoSourceLabel({}))
        .toBe('Source: Unnamed');
    });

    it('handles decimal wavelengths', () => {
      expect(formatOptoSourceLabel({ name: 'Laser', wavelength_in_nm: 473.5 }))
        .toBe('Source: Laser - 473.5nm');
    });
  });

  describe('formatOpticalFiberLabel', () => {
    it('formats complete fiber with name and location', () => {
      expect(formatOpticalFiberLabel({ name: 'Fiber1', location: 'CA1' }))
        .toBe('Fiber: Fiber1 - CA1');

      expect(formatOpticalFiberLabel({ name: 'LeftFiber', location: 'DG' }))
        .toBe('Fiber: LeftFiber - DG');
    });

    it('omits location when missing', () => {
      expect(formatOpticalFiberLabel({ name: 'Fiber1' }))
        .toBe('Fiber: Fiber1');
    });

    it('omits location when null', () => {
      expect(formatOpticalFiberLabel({ name: 'Fiber1', location: null }))
        .toBe('Fiber: Fiber1');
    });

    it('omits location when empty string', () => {
      expect(formatOpticalFiberLabel({ name: 'Fiber1', location: '' }))
        .toBe('Fiber: Fiber1');
    });

    it('handles missing name with "Unnamed" fallback', () => {
      expect(formatOpticalFiberLabel({ name: '', location: 'CA1' }))
        .toBe('Fiber: Unnamed - CA1');
    });

    it('handles both name and location missing', () => {
      expect(formatOpticalFiberLabel({}))
        .toBe('Fiber: Unnamed');
    });

    it('handles complex location names', () => {
      expect(formatOpticalFiberLabel({ name: 'Fiber2', location: 'alveus of the hippocampus (alv)' }))
        .toBe('Fiber: Fiber2 - alveus of the hippocampus (alv)');
    });
  });

  describe('formatVirusInjectionLabel', () => {
    it('formats complete injection with name and location', () => {
      expect(formatVirusInjectionLabel({ name: 'ChR2_injection', location: 'CA1' }))
        .toBe('Injection: ChR2_injection - CA1');

      expect(formatVirusInjectionLabel({ name: 'AAV_injection_1', location: 'DG' }))
        .toBe('Injection: AAV_injection_1 - DG');
    });

    it('omits location when missing', () => {
      expect(formatVirusInjectionLabel({ name: 'Injection1' }))
        .toBe('Injection: Injection1');
    });

    it('omits location when null', () => {
      expect(formatVirusInjectionLabel({ name: 'Injection1', location: null }))
        .toBe('Injection: Injection1');
    });

    it('omits location when empty string', () => {
      expect(formatVirusInjectionLabel({ name: 'Injection1', location: '' }))
        .toBe('Injection: Injection1');
    });

    it('handles missing name with "Unnamed" fallback', () => {
      expect(formatVirusInjectionLabel({ name: '', location: 'CA3' }))
        .toBe('Injection: Unnamed - CA3');
    });

    it('handles both name and location missing', () => {
      expect(formatVirusInjectionLabel({}))
        .toBe('Injection: Unnamed');
    });
  });

  describe('formatFsGuiLabel', () => {
    it('formats complete FsGUI with name', () => {
      expect(formatFsGuiLabel({ name: 'protocol_01.yml' }))
        .toBe('FsGUI: protocol_01.yml');

      expect(formatFsGuiLabel({ name: 'optogenetics_config.yaml' }))
        .toBe('FsGUI: optogenetics_config.yaml');
    });

    it('handles missing name with "Unnamed" fallback', () => {
      expect(formatFsGuiLabel({ name: '' }))
        .toBe('FsGUI: Unnamed');
    });

    it('handles null name', () => {
      expect(formatFsGuiLabel({ name: null }))
        .toBe('FsGUI: Unnamed');
    });

    it('handles undefined name', () => {
      expect(formatFsGuiLabel({}))
        .toBe('FsGUI: Unnamed');
    });

    it('handles long filenames with paths', () => {
      expect(formatFsGuiLabel({ name: '/configs/optogenetics/session_20240115_protocol.yml' }))
        .toBe('FsGUI: /configs/optogenetics/session_20240115_protocol.yml');
    });
  });

  describe('Edge Cases', () => {
    it('handles whitespace-only strings as empty', () => {
      // Note: Current implementation treats whitespace as truthy
      // This documents current behavior; may want to trim in future
      expect(formatTaskLabel({ task_name: '   ' }))
        .toBe('Task:    ');
    });

    it('handles special characters in names', () => {
      expect(formatTaskLabel({ task_name: 'task-with-dashes_and_underscores' }))
        .toBe('Task: task-with-dashes_and_underscores');

      expect(formatBehavioralEventLabel({ name: 'event/with/slashes' }))
        .toBe('Event: event/with/slashes');
    });

    it('handles unicode characters in names', () => {
      expect(formatTaskLabel({ task_name: 'café exploration' }))
        .toBe('Task: café exploration');
    });

    it('handles very long names without truncation', () => {
      const longName = 'a'.repeat(200);
      expect(formatTaskLabel({ task_name: longName }))
        .toBe(`Task: ${longName}`);
    });
  });
});
