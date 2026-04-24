const EARTH_RADIUS_KM = 6371;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function haversineDistanceKm(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number,
) {
  const latitudeDelta = toRadians(toLatitude - fromLatitude);
  const longitudeDelta = toRadians(toLongitude - fromLongitude);

  const originLatitude = toRadians(fromLatitude);
  const destinationLatitude = toRadians(toLatitude);

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

type FormatDistanceOptions = {
  locationEnabled: boolean;
  hasCoordinates: boolean;
};

export function formatDistance(distanceKm: number | undefined, options: FormatDistanceOptions) {
  if (distanceKm === undefined) {
    if (!options.locationEnabled) {
      return 'Споделете местоположението си, за да изчислим разстоянието';
    }

    if (!options.hasCoordinates) {
      return 'Няма координати за локацията';
    }

    return 'Разстоянието не е налично';
  }

  if (distanceKm < 1) {
    return `На ${Math.round(distanceKm * 1000)} м`;
  }

  return `На ${distanceKm.toFixed(1)} км`;
}
