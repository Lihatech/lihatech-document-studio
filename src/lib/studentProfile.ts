export const salutations = ['Mr.', 'Ms.', 'Mrs.', 'Mx.', 'Dr.'];
export const profileFields = ['salutation', 'full_name', 'phone', 'address', 'profile_type', 'college_name', 'department', 'college_location', 'office_name', 'job_title', 'office_location'] as const;
export type StudentProfileValues = Record<(typeof profileFields)[number], string>;

export function normalizeName(value: string) {
  const name = value.trim().replace(/\s+/g, ' ').replace(/^(?:(?:mr|mrs|ms|mx|dr)\.?\s+)+/i, '');
  return name === name.toLocaleLowerCase() || name === name.toLocaleUpperCase()
    ? name.toLocaleLowerCase().replace(/(^|[\s'’\-])(\p{L})/gu, (_, separator, letter) => separator + letter.toLocaleUpperCase())
    : name;
}

export function profileValues(student: Record<string, any>): StudentProfileValues {
  const prefix = String(student.full_name ?? '').trim().match(/^(mr|mrs|ms|mx|dr)\.?\s/i)?.[1];
  return { ...Object.fromEntries(profileFields.map(key => [key, student[key] ?? ''])),
    full_name: normalizeName(student.full_name ?? ''),
    salutation: student.salutation || salutations.find(value => value.toLowerCase() === `${prefix?.toLowerCase()}.`) || '',
  } as StudentProfileValues;
}

export const documentName = (values: StudentProfileValues) => [values.salutation, normalizeName(values.full_name)].filter(Boolean).join(' ');
