import React, { useEffect, useState } from 'react';
import { get, push, ref, remove, update } from 'firebase/database';
import { database } from '../firebase';

const MAX_PHOTO_BYTES = 300 * 1024;
const MAX_PHOTO_DIMENSION = 500;

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      try {
        const maxSide = Math.max(
          image.naturalWidth,
          image.naturalHeight
        );

        const scale = Math.min(
          1,
          MAX_PHOTO_DIMENSION / maxSide
        );

        const width = Math.max(
          1,
          Math.round(image.naturalWidth * scale)
        );

        const height = Math.max(
          1,
          Math.round(image.naturalHeight * scale)
        );

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error(
            'Браузърът не поддържа обработка на изображения.'
          );
        }

        // Бял фон, за да няма черен фон при PNG снимки
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        ctx.drawImage(
          image,
          0,
          0,
          width,
          height
        );

        let quality = 0.75;

        const makeDataUrl = () =>
          canvas.toDataURL(
            'image/jpeg',
            quality
          );

        let dataUrl = makeDataUrl();

        while (
          dataUrl.length * 0.75 > MAX_PHOTO_BYTES &&
          quality > 0.35
        ) {
          quality -= 0.05;
          dataUrl = makeDataUrl();
        }

        if (dataUrl.length * 0.75 > MAX_PHOTO_BYTES) {
          throw new Error(
            'Снимката остава прекалено голяма след компресиране.'
          );
        }

        resolve(dataUrl);
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(
        new Error('Снимката не може да бъде обработена.')
      );
    };

    image.src = objectUrl;
  });
}

function getNextNumericId(beneficiaries) {
  const ids = Object.values(beneficiaries)
    .map((beneficiary) => Number(beneficiary.id))
    .filter(
      (id) => Number.isInteger(id) && id > 0
    );

  if (ids.length === 0) {
    return 1;
  }

  return Math.max(...ids) + 1;
}

export default function Beneficiaries({ user }) {
  const [beneficiaries, setBeneficiaries] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);

  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const [form, setForm] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    gender: '',
    birthDate: '',
    identifier: '',
    status: 'active',
    photo: ''
  });

  useEffect(() => {
    loadBeneficiaries();
  }, []);

  async function loadBeneficiaries() {
    try {
      setLoading(true);

      const snapshot = await get(
        ref(database, 'beneficiaries')
      );

      if (snapshot.exists()) {
        setBeneficiaries(snapshot.val());
      } else {
        setBeneficiaries({});
      }
    } catch (error) {
      console.error(error);

      alert(
        `Грешка при зареждане на бенефициентите:\n${error.message}`
      );
    } finally {
      setLoading(false);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value
    }));
  }

  async function handlePhotoChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Моля, избери изображение.');
      return;
    }

    try {
      setSaving(true);

      const compressedImage =
        await compressImage(file);

      setForm((previous) => ({
        ...previous,
        photo: compressedImage
      }));
    } catch (error) {
      console.error(error);

      alert(
        `Грешка при обработка на снимката:\n${error.message}`
      );
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setEditingId(null);

    setForm({
      firstName: '',
      middleName: '',
      lastName: '',
      gender: '',
      birthDate: '',
      identifier: '',
      status: 'active',
      photo: ''
    });
  }

  function handleEdit(beneficiary) {
    setEditingId(beneficiary.firebaseKey);

    setForm({
      firstName: beneficiary.firstName || '',
      middleName: beneficiary.middleName || '',
      lastName: beneficiary.lastName || '',
      gender: beneficiary.gender || '',
      birthDate: beneficiary.birthDate || '',
      identifier: beneficiary.identifier || '',
      status: beneficiary.status || 'active',
      photo: beneficiary.photo || ''
    });

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  async function handleDelete(beneficiary) {
    const fullName = [
      beneficiary.firstName,
      beneficiary.middleName,
      beneficiary.lastName
    ]
      .filter(Boolean)
      .join(' ');

    const confirmed = window.confirm(
      `Сигурен ли си, че искаш да изтриеш бенефициент №${beneficiary.id}${
        fullName ? ` - ${fullName}` : ''
      }?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);

      await remove(
        ref(
          database,
          `beneficiaries/${beneficiary.firebaseKey}`
        )
      );

      setBeneficiaries((previous) => {
        const copy = { ...previous };

        delete copy[beneficiary.firebaseKey];

        return copy;
      });

      if (
        editingId === beneficiary.firebaseKey
      ) {
        resetForm();
      }
    } catch (error) {
      console.error(error);

      alert(
        `Грешка при изтриване:\n${error.code || ''}\n${error.message}`
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.firstName.trim()) {
      alert('Моля, въведи собствено име.');
      return;
    }

    if (!form.lastName.trim()) {
      alert('Моля, въведи фамилия.');
      return;
    }

    try {
      setSaving(true);

      let beneficiaryId = editingId
        ? beneficiaries[editingId]?.id
        : null;

      // При нов бенефициент генерираме числово ID
      if (!beneficiaryId) {
        beneficiaryId =
          getNextNumericId(beneficiaries);
      }

      const beneficiaryData = {
        id: Number(beneficiaryId),

        firstName: form.firstName.trim(),
        middleName: form.middleName.trim(),
        lastName: form.lastName.trim(),

        gender: form.gender,
        birthDate: form.birthDate,
        identifier: form.identifier.trim(),

        status: form.status,
        active: form.status === 'active',
        archived: form.status === 'archived',

        photo: form.photo || '',

        updatedBy:
          user?.uid || 'unknown',

        updatedAt: Date.now()
      };

      if (editingId) {
        await update(
          ref(
            database,
            `beneficiaries/${editingId}`
          ),
          beneficiaryData
        );

        setBeneficiaries((previous) => ({
          ...previous,
          [editingId]: {
            ...previous[editingId],
            ...beneficiaryData,
            firebaseKey: editingId
          }
        }));
      } else {
        // Firebase ключът е вътрешен,
        // но видимото ID е само числово.
        const newRef = push(
          ref(database, 'beneficiaries')
        );

        const firebaseKey = newRef.key;

        const newBeneficiary = {
          ...beneficiaryData,

          createdBy:
            user?.uid || 'unknown',

          createdAt: Date.now(),

          firebaseKey
        };

        await update(
          newRef,
          newBeneficiary
        );

        setBeneficiaries((previous) => ({
          ...previous,
          [firebaseKey]: newBeneficiary
        }));
      }

      resetForm();
    } catch (error) {
      console.error(error);

      alert(
        `Грешка при записване:\n${
          error.code || ''
        }\n${error.message}`
      );
    } finally {
      setSaving(false);
    }
  }

  function openPhoto(photo) {
    if (!photo) {
      return;
    }

    setSelectedPhoto(photo);
  }

  function closePhoto() {
    setSelectedPhoto(null);
  }

  const beneficiaryList = Object.entries(
    beneficiaries
  )
    .map(([firebaseKey, beneficiary]) => ({
      ...beneficiary,
      firebaseKey
    }))
    .sort(
      (a, b) =>
        Number(a.id || 0) -
        Number(b.id || 0)
    );

  const filteredBeneficiaries =
    beneficiaryList.filter((beneficiary) => {
      const text = [
        beneficiary.id,
        beneficiary.firstName,
        beneficiary.middleName,
        beneficiary.lastName,
        beneficiary.identifier
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return text.includes(
        search.toLowerCase()
      );
    });

  return (
    <div
      style={{
        padding: '24px',
        maxWidth: '1400px',
        margin: '0 auto'
      }}
    >
      <h1 style={{ marginBottom: '24px' }}>
        Бенефициенти
      </h1>

      {/* FORM */}
      <form
        onSubmit={handleSubmit}
        style={{
          background: '#fff',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '24px',
          boxShadow:
            '0 2px 10px rgba(0,0,0,0.08)'
        }}
      >
        <h2>
          {editingId
            ? `Редактиране на бенефициент №${
                beneficiaries[editingId]?.id || ''
              }`
            : 'Нов бенефициент'}
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginTop: '16px'
          }}
        >
          <div>
            <label>Собствено име *</label>

            <input
              type="text"
              name="firstName"
              value={form.firstName}
              onChange={handleChange}
              style={inputStyle}
              required
            />
          </div>

          <div>
            <label>Бащино име</label>

            <input
              type="text"
              name="middleName"
              value={form.middleName}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>

          <div>
            <label>Фамилия *</label>

            <input
              type="text"
              name="lastName"
              value={form.lastName}
              onChange={handleChange}
              style={inputStyle}
              required
            />
          </div>

          <div>
            <label>Пол</label>

            <select
              name="gender"
              value={form.gender}
              onChange={handleChange}
              style={inputStyle}
            >
              <option value="">
                Избери
              </option>
              <option value="male">
                Мъж
              </option>
              <option value="female">
                Жена
              </option>
            </select>
          </div>

          <div>
            <label>Дата на раждане</label>

            <input
              type="date"
              name="birthDate"
              value={form.birthDate}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>

          <div>
            <label>Идентификатор</label>

            <input
              type="text"
              name="identifier"
              value={form.identifier}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>

          <div>
            <label>Статус</label>

            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              style={inputStyle}
            >
              <option value="active">
                Активен
              </option>

              <option value="archived">
                Архивиран
              </option>
            </select>
          </div>

          <div>
            <label>Снимка</label>

            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              style={{
                ...inputStyle,
                padding: '8px'
              }}
            />
          </div>
        </div>

        {/* PHOTO PREVIEW */}
        {form.photo && (
          <div
            style={{
              marginTop: '20px'
            }}
          >
            <div
              style={{
                fontWeight: '600',
                marginBottom: '8px'
              }}
            >
              Преглед на снимката:
            </div>

            <img
              src={form.photo}
              alt="Преглед"
              onClick={() =>
                openPhoto(form.photo)
              }
              style={{
                width: '120px',
                height: '120px',
                objectFit: 'cover',
                borderRadius: '10px',
                border:
                  '2px solid #ddd',
                cursor: 'pointer'
              }}
              title="Кликни за голям размер"
            />
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: '10px',
            marginTop: '20px'
          }}
        >
          <button
            type="submit"
            disabled={saving}
            style={primaryButtonStyle}
          >
            {saving
              ? 'Записване...'
              : editingId
              ? 'Запази промените'
              : 'Добави бенефициент'}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              style={secondaryButtonStyle}
            >
              Отказ
            </button>
          )}
        </div>
      </form>

      {/* SEARCH */}
      <div
        style={{
          background: '#fff',
          padding: '16px',
          borderRadius: '12px',
          marginBottom: '16px',
          boxShadow:
            '0 2px 10px rgba(0,0,0,0.06)'
        }}
      >
        <input
          type="text"
          placeholder="Търси по ID, име, фамилия или идентификатор..."
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          style={{
            ...inputStyle,
            width: '100%',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* TABLE */}
      <div
        style={{
          background: '#fff',
          borderRadius: '12px',
          overflow: 'auto',
          boxShadow:
            '0 2px 10px rgba(0,0,0,0.08)'
        }}
      >
        {loading ? (
          <div
            style={{
              padding: '30px',
              textAlign: 'center'
            }}
          >
            Зареждане...
          </div>
        ) : (
          <table
            style={{
              width: '100%',
              borderCollapse:
                'collapse'
            }}
          >
            <thead>
              <tr
                style={{
                  background:
                    '#f5f5f5'
                }}
              >
                <th style={thStyle}>
                  ID
                </th>

                <th style={thStyle}>
                  Снимка
                </th>

                <th style={thStyle}>
                  Име
                </th>

                <th style={thStyle}>
                  Пол
                </th>

                <th style={thStyle}>
                  Дата на раждане
                </th>

                <th style={thStyle}>
                  Идентификатор
                </th>

                <th style={thStyle}>
                  Статус
                </th>

                <th style={thStyle}>
                  Действия
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredBeneficiaries.map(
                (beneficiary) => {
                  const fullName = [
                    beneficiary.firstName,
                    beneficiary.middleName,
                    beneficiary.lastName
                  ]
                    .filter(Boolean)
                    .join(' ');

                  return (
                    <tr
                      key={
                        beneficiary.firebaseKey
                      }
                    >
                      <td style={tdStyle}>
                        <strong>
                          {beneficiary.id}
                        </strong>
                      </td>

                      <td style={tdStyle}>
                        {beneficiary.photo ? (
                          <img
                            src={
                              beneficiary.photo
                            }
                            alt={fullName}
                            onClick={() =>
                              openPhoto(
                                beneficiary.photo
                              )
                            }
                            style={{
                              width: '60px',
                              height: '60px',
                              objectFit:
                                'cover',
                              borderRadius:
                                '8px',
                              cursor:
                                'pointer',
                              border:
                                '2px solid #ddd'
                            }}
                            title="Кликни за голям размер"
                          />
                        ) : (
                          <span
                            style={{
                              color:
                                '#999'
                            }}
                          >
                            Няма снимка
                          </span>
                        )}
                      </td>

                      <td style={tdStyle}>
                        {fullName}
                      </td>

                      <td style={tdStyle}>
                        {beneficiary.gender ===
                        'male'
                          ? 'Мъж'
                          : beneficiary.gender ===
                            'female'
                          ? 'Жена'
                          : '-'}
                      </td>

                      <td style={tdStyle}>
                        {beneficiary.birthDate ||
                          '-'}
                      </td>

                      <td style={tdStyle}>
                        {beneficiary.identifier ||
                          '-'}
                      </td>

                      <td style={tdStyle}>
                        <span
                          style={{
                            display:
                              'inline-block',
                            padding:
                              '5px 10px',
                            borderRadius:
                              '20px',
                            background:
                              beneficiary.status ===
                              'archived'
                                ? '#eee'
                                : '#e8f5e9',
                            color:
                              beneficiary.status ===
                              'archived'
                                ? '#666'
                                : '#2e7d32',
                            fontSize:
                              '13px'
                          }}
                        >
                          {beneficiary.status ===
                          'archived'
                            ? 'Архивиран'
                            : 'Активен'}
                        </span>
                      </td>

                      <td style={tdStyle}>
                        <div
                          style={{
                            display:
                              'flex',
                            gap: '8px',
                            flexWrap:
                              'wrap'
                          }}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              handleEdit(
                                beneficiary
                              )
                            }
                            style={
                              editButtonStyle
                            }
                          >
                            Редактирай
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleDelete(
                                beneficiary
                              )
                            }
                            disabled={saving}
                            style={
                              deleteButtonStyle
                            }
                          >
                            Изтрий
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }
              )}

              {filteredBeneficiaries.length ===
                0 && (
                <tr>
                  <td
                    colSpan="8"
                    style={{
                      padding:
                        '30px',
                      textAlign:
                        'center',
                      color:
                        '#777'
                    }}
                  >
                    Няма намерени
                    бенефициенти.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* PHOTO MODAL */}
      {selectedPhoto && (
        <div
          onClick={closePhoto}
          style={{
            position: 'fixed',
            inset: 0,
            background:
              'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems:
              'center',
            justifyContent:
              'center',
            zIndex: 9999,
            padding: '30px',
            cursor: 'zoom-out'
          }}
        >
          <button
            type="button"
            onClick={closePhoto}
            style={{
              position:
                'absolute',
              top: '20px',
              right: '25px',
              width: '45px',
              height: '45px',
              border: 'none',
              borderRadius:
                '50%',
              background:
                'rgba(255,255,255,0.9)',
              color: '#222',
              fontSize:
                '30px',
              lineHeight: '1',
              cursor: 'pointer',
              zIndex: 10000
            }}
            aria-label="Затвори"
          >
            ×
          </button>

          <img
            src={selectedPhoto}
            alt="Снимка на бенефициента"
            onClick={(event) =>
              event.stopPropagation()
            }
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              objectFit:
                'contain',
              borderRadius:
                '10px',
              boxShadow:
                '0 10px 40px rgba(0,0,0,0.5)',
              cursor: 'default'
            }}
          />
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  marginTop: '6px',
  padding: '10px 12px',
  border: '1px solid #ccc',
  borderRadius: '8px',
  fontSize: '14px',
  boxSizing: 'border-box'
};

const thStyle = {
  padding: '12px',
  textAlign: 'left',
  borderBottom:
    '1px solid #ddd',
  whiteSpace: 'nowrap'
};

const tdStyle = {
  padding: '12px',
  borderBottom:
    '1px solid #eee',
  verticalAlign: 'middle'
};

const primaryButtonStyle = {
  border: 'none',
  borderRadius: '8px',
  padding: '10px 16px',
  background: '#1976d2',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: '600'
};

const secondaryButtonStyle = {
  border: '1px solid #ccc',
  borderRadius: '8px',
  padding: '10px 16px',
  background: '#fff',
  color: '#333',
  cursor: 'pointer'
};

const editButtonStyle = {
  border: 'none',
  borderRadius: '6px',
  padding: '7px 10px',
  background: '#1976d2',
  color: '#fff',
  cursor: 'pointer',
  fontSize: '13px'
};

const deleteButtonStyle = {
  border: 'none',
  borderRadius: '6px',
  padding: '7px 10px',
  background: '#d32f2f',
  color: '#fff',
  cursor: 'pointer',
  fontSize: '13px'
};
