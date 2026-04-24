import type { LocationPermissionStatus } from '../types';

type LocationPermissionProps = {
  status: LocationPermissionStatus;
  errorMessage?: string;
  onRequest: () => void;
};

function getCopy(status: LocationPermissionStatus, errorMessage?: string) {
  switch (status) {
    case 'granted':
      return 'Подреждането по близост е активно. Събитията с координати се сортират първо по дата, после по разстояние.';
    case 'loading':
      return 'Проверяваме местоположението ви. Ако разрешението още не е избрано, браузърът трябва да покаже запитване.';
    case 'denied':
      return 'Достъпът до местоположението е изключен, затова списъкът се подрежда само по дата. Можете да го включите от настройките на браузъра.';
    case 'error':
      return errorMessage ?? 'Неуспешно определяне на местоположението. Можете да използвате приложението и със сортиране по дата.';
    case 'unsupported':
      return 'Този браузър не поддържа геолокация. Подреждането по близост не е налично.';
    case 'prompt':
    case 'idle':
    default:
      return 'Приложението ще поиска достъп до местоположението ви, за да откроява близките откривания и да включи филтър по разстояние.';
  }
}

export function LocationPermission({ status, errorMessage, onRequest }: LocationPermissionProps) {
  return (
    <section className="location-panel" aria-labelledby="location-panel-title">
      <div>
        <p className="eyebrow">Локация</p>
        <h2 id="location-panel-title">Приоритизирайте близките галерии</h2>
        <p>{getCopy(status, errorMessage)}</p>
      </div>

      <button type="button" className="primary-button" onClick={onRequest} disabled={status === 'loading'}>
        {status === 'granted' ? 'Обнови локацията' : status === 'loading' ? 'Определяне…' : 'Използвай моята локация'}
      </button>
    </section>
  );
}
