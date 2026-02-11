import UploadCard from '../../components/UploadCard';
import { parseSeaData } from '../shared/excel-parsers';

type UploadSeaPageProps = {
  onUnauthorized?: () => void;
};

export default function UploadSeaPage({ onUnauthorized }: UploadSeaPageProps) {
  return (
    <section id="sales-interface" className="section">
      <div className="trd-shell">
        <div className="trd-topbar">
          <div className="trd-title">
            <div className="trd-subtitle">Загрузка Excel</div>
            <h2>Море</h2>
          </div>
        </div>
        <UploadCard title="" dbType="sea" parse={parseSeaData} onUnauthorized={onUnauthorized} variant="inline" />
      </div>
    </section>
  );
}
