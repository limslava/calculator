import UploadCard from '../../components/UploadCard';
import { parseDirectSeaData } from '../shared/excel-parsers';

type UploadDirectSeaPageProps = {
  onUnauthorized?: () => void;
};

export default function UploadDirectSeaPage({ onUnauthorized }: UploadDirectSeaPageProps) {
  return (
    <section id="sales-interface" className="section">
      <div className="trd-shell">
        <div className="trd-topbar">
          <div className="trd-title">
            <div className="trd-subtitle">Загрузка Excel</div>
            <h2>Прямое море</h2>
          </div>
        </div>
        <UploadCard
          title=""
          dbType="direct_sea"
          parse={parseDirectSeaData}
          onUnauthorized={onUnauthorized}
          variant="inline"
        />
      </div>
    </section>
  );
}
