import UploadCard from '../../components/UploadCard';
import { parseDirectRailData } from '../shared/excel-parsers';

type UploadDirectRailPageProps = {
  onUnauthorized?: () => void;
};

export default function UploadDirectRailPage({ onUnauthorized }: UploadDirectRailPageProps) {
  return (
    <section id="sales-interface" className="section">
      <div className="trd-shell">
        <div className="trd-topbar">
          <div className="trd-title">
            <div className="trd-subtitle">Загрузка Excel</div>
            <h2>Прямое ЖД</h2>
          </div>
        </div>
        <UploadCard
          title=""
          dbType="direct_rail"
          parse={parseDirectRailData}
          onUnauthorized={onUnauthorized}
          variant="inline"
        />
      </div>
    </section>
  );
}
