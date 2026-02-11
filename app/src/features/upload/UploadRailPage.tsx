import UploadCard from '../../components/UploadCard';
import { parseRailData } from '../shared/excel-parsers';

type UploadRailPageProps = {
  onUnauthorized?: () => void;
};

export default function UploadRailPage({ onUnauthorized }: UploadRailPageProps) {
  return (
    <section id="sales-interface" className="section">
      <div className="trd-shell">
        <div className="trd-topbar">
          <div className="trd-title">
            <div className="trd-subtitle">Загрузка Excel</div>
            <h2>ЖД</h2>
          </div>
        </div>
        <UploadCard title="" dbType="rail" parse={parseRailData} onUnauthorized={onUnauthorized} variant="inline" />
      </div>
    </section>
  );
}
