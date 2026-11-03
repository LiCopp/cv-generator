import { entryPeriod, type Entry, type Layout } from '@cv/core';

export function StationHeading({
  entry,
  order,
}: {
  entry: Entry;
  order: Layout['appearance']['stationHeadingOrder'];
}) {
  const date = entryPeriod(entry),
    organization = [entry.organization, entry.location].filter(Boolean).join(' · ');
  const fields = {
    date: date && (
      <div className="cv-date" data-station-field="date" key="date">
        {date}
      </div>
    ),
    title: (
      <h3 data-station-field="title" key="title">
        {entry.title || 'Neuer Eintrag'}
      </h3>
    ),
    organization: organization && (
      <p className="cv-organization" data-station-field="organization" key="organization">
        {organization}
      </p>
    ),
  };
  return <div className="cv-entry-title">{order.map((field) => fields[field])}</div>;
}
