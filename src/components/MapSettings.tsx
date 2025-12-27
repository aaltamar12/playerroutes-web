'use client';

import { useState, useEffect } from 'react';

export interface MapDisplaySettings {
  routeWidth: number;        // 1-10
  routeOpacity: number;      // 0.1-1
  routeColor: string;        // hex color
  markerSize: number;        // 3-15
  glowSize: number;          // 0-20
  showLabels: boolean;
  labelSize: number;         // 8-16
  showInactivePaths: boolean;
}

// Preset colors for routes
export const routeColorPresets = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'White', value: '#ffffff' },
];

export const defaultSettings: MapDisplaySettings = {
  routeWidth: 2,
  routeOpacity: 0.7,
  routeColor: '#3b82f6',
  markerSize: 5,
  glowSize: 8,
  showLabels: true,
  labelSize: 11,
  showInactivePaths: true,
};

const STORAGE_KEY = 'playerroutes_map_settings';

export function loadMapSettings(): MapDisplaySettings {
  if (typeof window === 'undefined') return defaultSettings;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Failed to load map settings:', e);
  }
  return defaultSettings;
}

export function saveMapSettings(settings: MapDisplaySettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save map settings:', e);
  }
}

interface MapSettingsProps {
  settings: MapDisplaySettings;
  onChange: (settings: MapDisplaySettings) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function MapSettings({ settings, onChange, isOpen, onClose }: MapSettingsProps) {
  const [localSettings, setLocalSettings] = useState(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const updateSetting = <K extends keyof MapDisplaySettings>(key: K, value: MapDisplaySettings[K]) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    onChange(newSettings);
    saveMapSettings(newSettings);
  };

  const resetToDefaults = () => {
    setLocalSettings(defaultSettings);
    onChange(defaultSettings);
    saveMapSettings(defaultSettings);
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-16 right-14 bg-slate-800 rounded-lg shadow-xl border border-slate-700 p-4 w-72 z-20">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Display Settings</h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-4">
        {/* Route Width */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">Route Width</span>
            <span className="text-white">{localSettings.routeWidth}px</span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            step="0.5"
            value={localSettings.routeWidth}
            onChange={(e) => updateSetting('routeWidth', parseFloat(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>

        {/* Route Opacity */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">Route Opacity</span>
            <span className="text-white">{Math.round(localSettings.routeOpacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={localSettings.routeOpacity}
            onChange={(e) => updateSetting('routeOpacity', parseFloat(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>

        {/* Route Color */}
        <div>
          <div className="flex justify-between text-xs mb-2">
            <span className="text-slate-400">Route Color</span>
            <div
              className="w-5 h-5 rounded border border-slate-600"
              style={{ backgroundColor: localSettings.routeColor }}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {routeColorPresets.map((color) => (
              <button
                key={color.value}
                onClick={() => updateSetting('routeColor', color.value)}
                className={`w-6 h-6 rounded border-2 transition-all cursor-pointer ${
                  localSettings.routeColor === color.value
                    ? 'border-white scale-110'
                    : 'border-transparent hover:border-slate-500'
                }`}
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
            {/* Custom color input */}
            <div className="relative">
              <input
                type="color"
                value={localSettings.routeColor}
                onChange={(e) => updateSetting('routeColor', e.target.value)}
                className="w-6 h-6 rounded cursor-pointer opacity-0 absolute inset-0"
              />
              <div
                className="w-6 h-6 rounded border-2 border-dashed border-slate-500 flex items-center justify-center text-slate-400 text-xs"
                title="Custom color"
              >
                +
              </div>
            </div>
          </div>
        </div>

        {/* Marker Size */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">Marker Size</span>
            <span className="text-white">{localSettings.markerSize}px</span>
          </div>
          <input
            type="range"
            min="3"
            max="15"
            step="1"
            value={localSettings.markerSize}
            onChange={(e) => updateSetting('markerSize', parseInt(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>

        {/* Glow Size */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">Glow Size</span>
            <span className="text-white">{localSettings.glowSize}px</span>
          </div>
          <input
            type="range"
            min="0"
            max="20"
            step="1"
            value={localSettings.glowSize}
            onChange={(e) => updateSetting('glowSize', parseInt(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>

        {/* Label Size */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">Label Size</span>
            <span className="text-white">{localSettings.labelSize}px</span>
          </div>
          <input
            type="range"
            min="8"
            max="18"
            step="1"
            value={localSettings.labelSize}
            onChange={(e) => updateSetting('labelSize', parseInt(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>

        {/* Toggles */}
        <div className="space-y-2 pt-2 border-t border-slate-700">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-xs text-slate-400">Show Player Labels</span>
            <input
              type="checkbox"
              checked={localSettings.showLabels}
              onChange={(e) => updateSetting('showLabels', e.target.checked)}
              className="w-4 h-4 accent-blue-500"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-xs text-slate-400">Show Offline Paths</span>
            <input
              type="checkbox"
              checked={localSettings.showInactivePaths}
              onChange={(e) => updateSetting('showInactivePaths', e.target.checked)}
              className="w-4 h-4 accent-blue-500"
            />
          </label>
        </div>

        {/* Reset Button */}
        <button
          onClick={resetToDefaults}
          className="w-full mt-2 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}
