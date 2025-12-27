'use client';

interface WorldTimeProps {
  worldTime: number | null;
}

// Convert Minecraft ticks (0-24000) to readable time
// 0 = 6:00 AM (sunrise), 6000 = noon, 12000 = sunset, 18000 = midnight
function ticksToTime(ticks: number): { hours: number; minutes: number; period: 'AM' | 'PM'; icon: string } {
  // Convert ticks to hours (0-24)
  const tickHours = ticks / 1000;
  // Minecraft day starts at 6 AM
  const hours24 = (tickHours + 6) % 24;
  const hours12 = hours24 % 12 || 12;
  const minutes = Math.floor((hours24 % 1) * 60);
  const period: 'AM' | 'PM' = hours24 < 12 ? 'AM' : 'PM';

  // Determine icon based on time of day
  let icon = '☀️'; // Default day
  if (ticks >= 0 && ticks < 1000) {
    icon = '🌅'; // Sunrise
  } else if (ticks >= 1000 && ticks < 6000) {
    icon = '☀️'; // Morning
  } else if (ticks >= 6000 && ticks < 11000) {
    icon = '☀️'; // Midday
  } else if (ticks >= 11000 && ticks < 13000) {
    icon = '🌇'; // Sunset
  } else if (ticks >= 13000 && ticks < 23000) {
    icon = '🌙'; // Night
  } else {
    icon = '🌅'; // Dawn
  }

  return { hours: Math.floor(hours12), minutes, period, icon };
}

export function WorldTime({ worldTime }: WorldTimeProps) {
  if (worldTime === null) {
    return null;
  }

  const { hours, minutes, period, icon } = ticksToTime(worldTime);
  const timeString = `${hours}:${minutes.toString().padStart(2, '0')} ${period}`;

  return (
    <div className="flex items-center gap-1.5 bg-slate-800/90 px-2 py-1 rounded text-sm">
      <span>{icon}</span>
      <span className="text-slate-200 font-mono">{timeString}</span>
    </div>
  );
}
