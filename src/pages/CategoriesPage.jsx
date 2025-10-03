// src/pages/CategoriesPage.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import {
  collection, query, where, getDocs, orderBy,
  addDoc, updateDoc, doc, writeBatch, deleteDoc
} from 'firebase/firestore';
import { db, storage } from '../firebase/config';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

import {
  Box, Breadcrumbs, Button, Chip, Divider, FormControl, FormControlLabel,
  Grid, IconButton, InputLabel, MenuItem, Modal, OutlinedInput, Paper,
  Select, Switch, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Typography
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';

// dnd-kit
import { DndContext, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const modalStyle = {
  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
  width: 800, bgcolor: 'background.paper', border: '2px solid #000',
  boxShadow: 24, p: 4, display: 'flex', flexDirection: 'column', maxHeight: '90vh'
};

const TAGS = ['todas', 'destacadas'];

function SortableCategoryRow({ cat, onEdit, onDelete, dragDisabled }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: cat.firestoreId,
    disabled: dragDisabled
  });
  const rowStyle = {
    transform: CSS.Transform.toString(transform),
    transition
  };
  return (
    <TableRow ref={setNodeRef} style={rowStyle} {...attributes}>
      <TableCell {...listeners} sx={{ width: 50, cursor: dragDisabled ? 'not-allowed' : 'grab' }}>
        <DragIndicatorIcon />
      </TableCell>
      <TableCell>
        {cat.Imagen
          ? <img src={cat.Imagen} alt={cat.Categoria} style={{ width: 56, height: 56, borderRadius: 6, objectFit: 'cover' }} />
          : '—'}
      </TableCell>
      <TableCell>{cat.Categoria}</TableCell>
      <TableCell>{cat.posicion || 0}</TableCell>
      <TableCell>{cat.disponible ? 'Sí' : 'No'}</TableCell>
      <TableCell>{cat.categoriaDestacada ? 'Sí' : 'No'}</TableCell>
      <TableCell align="right">
        <IconButton color="primary" onClick={() => onEdit(cat)}><EditIcon /></IconButton>
        <IconButton color="error" onClick={() => onDelete(cat)}><DeleteIcon /></IconButton>
      </TableCell>
    </TableRow>
  );
}

export default function CategoriesPage() {
  const { uuidEmpresa } = useParams();
  const navigate = useNavigate();

  const [business, setBusiness] = useState(null);
  const [isSuper, setIsSuper] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // búsqueda local por nombre de categoría (opcional)
  const [search, setSearch] = useState('');

  // modal
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [imageFile, setImageFile] = useState(null);

  const [form, setForm] = useState({
    Categoria: '',
    posicion: 0,
    disponible: true,
    categoriaDestacada: false,
    subCategoriasText: ['Todos'],
    tags: ['todas'],
    Imagen: ''
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // negocio
      const qBiz = query(collection(db, 'NegociosAfiliados'), where('uuidEmpresa', '==', uuidEmpresa));
      const snapBiz = await getDocs(qBiz);
      if (!snapBiz.empty) {
        const biz = { firestoreId: snapBiz.docs[0].id, ...snapBiz.docs[0].data() };
        setBusiness(biz);
        setIsSuper(biz.mostrarComoSuper === true);
      }

      // categorías
      const qCats = query(
        collection(db, 'Categorias'),
        where('uuidEmpresa', '==', uuidEmpresa),
        orderBy('posicion', 'asc')
      );
      const snapCats = await getDocs(qCats);
      setCategories(snapCats.docs.map(d => ({ firestoreId: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [uuidEmpresa]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return categories;
    return categories.filter(c => (c.Categoria || '').toLowerCase().includes(t));
  }, [categories, search]);

  const handleOpenNew = () => {
    setEditing(null);
    setImageFile(null);
    setForm({
      Categoria: '',
      posicion: (categories?.length || 0) + 1,
      disponible: true,
      categoriaDestacada: false,
      subCategoriasText: ['Todos'],
      tags: ['todas'],
      Imagen: ''
    });
    setOpen(true);
  };

  const handleOpenEdit = (cat) => {
    setEditing(cat);
    setImageFile(null);
    setForm({
      Categoria: cat.Categoria || '',
      posicion: cat.posicion || 0,
      disponible: !!cat.disponible,
      categoriaDestacada: !!cat.categoriaDestacada,
      subCategoriasText: Array.isArray(cat.subCategoriasText) && cat.subCategoriasText.length ? cat.subCategoriasText : ['Todos'],
      tags: Array.isArray(cat.tags) && cat.tags.length ? cat.tags : (cat.categoriaDestacada ? ['destacadas'] : ['todas']),
      Imagen: cat.Imagen || ''
    });
    setOpen(true);
  };

  const handleClose = () => setOpen(false);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const addSubcat = () => {
    const v = (form._newSubcat || '').trim();
    if (!v) return;
    const exists = (form.subCategoriasText || []).some(s => s.toLowerCase() === v.toLowerCase());
    if (exists) { setForm(p => ({ ...p, _newSubcat: '' })); return; }
    setForm(p => ({ ...p, subCategoriasText: [...(p.subCategoriasText || []), v], _newSubcat: '' }));
  };

  const removeSubcat = (name) => {
    setForm(p => ({ ...p, subCategoriasText: (p.subCategoriasText || []).filter(s => s !== name) }));
  };

  const uploadImageIfAny = async (uuid, file) => {
    if (!file) return null;
    const storageRef = ref(storage, `category_images/${uuidEmpresa}/${uuid}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    return url;
  };

  const saveCategory = async () => {
    if (!form.Categoria) { alert('El nombre de la categoría es obligatorio.'); return; }
    if (isSuper && !editing && !imageFile) { alert('La imagen es obligatoria para supermercados.'); return; }

    const uuid = editing?.uuid || uuidv4();
    const imageUrl = imageFile ? (await uploadImageIfAny(uuid, imageFile)) : (editing?.Imagen || '');

    const tags = form.tags?.length ? Array.from(new Set(form.tags)) : ['todas'];
    const payload = {
      Categoria: form.Categoria,
      Imagen: imageUrl,
      uuid,
      empresaenTexto: business?.NombredelNegocio || '',
      uuidEmpresa,
      posicion: Number(form.posicion) || 0,
      disponible: !!form.disponible,
      categoriaDestacada: tags.includes('destacadas'),
      subCategoriasText: isSuper ? (form.subCategoriasText?.length ? Array.from(new Set(['Todos', ...form.subCategoriasText.filter(s => s !== 'Todos')])) : ['Todos']) : [],
      tags
    };

    if (editing) {
      await updateDoc(doc(db, 'Categorias', editing.firestoreId), payload);
    } else {
      await addDoc(collection(db, 'Categorias'), payload);
    }
    handleClose();
    await fetchAll();
  };

  const deleteCategory = async (cat) => {
    if (!window.confirm(`¿Eliminar la categoría "${cat.Categoria}"?`)) return;
    try {
      // borrar doc
      await deleteDoc(doc(db, 'Categorias', cat.firestoreId));
      // intentar borrar imagen (ruta conocida)
      try {
        const imgRef = ref(storage, `category_images/${uuidEmpresa}/${cat.uuid}`);
        await deleteObject(imgRef);
      } catch (_) {}
      await fetchAll();
    } catch (e) {
      console.error(e);
      alert('No se pudo eliminar la categoría.');
    }
  };

  // Drag & drop
  const onDragEnd = useCallback(async ({ active, over }) => {
    if (!over || active.id === over.id) return;

    const oldIndex = filtered.findIndex(c => c.firestoreId === active.id);
    const newIndex = filtered.findIndex(c => c.firestoreId === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(filtered, oldIndex, newIndex);

    // recalcular posiciones para TODAS las categorías segun nuevo orden en "filtered"
    const newMap = new Map(reordered.map((c, idx) => [c.firestoreId, idx + 1]));
    const updated = categories.map(c => newMap.has(c.firestoreId) ? ({ ...c, posicion: newMap.get(c.firestoreId) }) : c);
    setCategories(updated);

    try {
      const batch = writeBatch(db);
      reordered.forEach((c, idx) => {
        const refDoc = doc(db, 'Categorias', c.firestoreId);
        batch.update(refDoc, { posicion: idx + 1 });
      });
      await batch.commit();
    } catch (e) {
      console.error(e);
      alert('No se pudo guardar el nuevo orden.');
      fetchAll();
    }
  }, [filtered, categories, fetchAll]);

  if (loading) return <Typography>Cargando categorías…</Typography>;
  if (!business) return <Typography>No se pudo cargar el negocio.</Typography>;

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 2 }}>
        <Link to="/negocios" style={{ textDecoration: 'none', color: 'inherit' }}>Negocios</Link>
        <Link to={`/negocios/${uuidEmpresa}/productos`} style={{ textDecoration: 'none', color: 'inherit' }}>{business.NombredelNegocio}</Link>
        <Typography color="text.primary">Categorías</Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Categorías de “{business.NombredelNegocio}”</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenNew}>Agregar categoría</Button>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="Buscar categoría…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={6} display="flex" alignItems="center">
            <Typography variant="body2" color="text.secondary">
              {isSuper ? 'Este negocio es Supermercado: la imagen es obligatoria y puedes definir subcategorías.' : 'Negocio normal: imagen opcional.'}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 50 }}></TableCell>
                <TableCell>Imagen</TableCell>
                <TableCell>Nombre</TableCell>
                <TableCell>Posición</TableCell>
                <TableCell>Disponible</TableCell>
                <TableCell>Destacada</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <SortableContext items={filtered.map(c => c.firestoreId)} strategy={verticalListSortingStrategy}>
              <TableBody>
                {filtered.length ? filtered.map(cat => (
                  <SortableCategoryRow
                    key={cat.firestoreId}
                    cat={cat}
                    onEdit={handleOpenEdit}
                    onDelete={deleteCategory}
                    dragDisabled={false}
                  />
                )) : (
                  <TableRow><TableCell colSpan={7} align="center">Sin categorías.</TableCell></TableRow>
                )}
              </TableBody>
            </SortableContext>
          </Table>
        </TableContainer>
      </DndContext>

      <Modal open={open} onClose={handleClose}>
        <Box sx={modalStyle}>
          <Typography variant="h6">{editing ? 'Editar categoría' : 'Nueva categoría'}</Typography>

          <Box sx={{ flexGrow: 1, overflowY: 'auto', pr: 1, mt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField name="Categoria" label="Nombre de la categoría" fullWidth required value={form.Categoria} onChange={onChange} />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField name="posicion" label="Posición" type="number" fullWidth value={form.posicion} onChange={onChange} />
              </Grid>
              <Grid item xs={12} sm={3}>
                <FormControl fullWidth>
                  <InputLabel>Tags</InputLabel>
                  <Select
                    multiple
                    name="tags"
                    value={form.tags}
                    onChange={onChange}
                    input={<OutlinedInput label="Tags" />}
                    renderValue={(selected) => selected.join(', ')}
                  >
                    {TAGS.map(t => (
                      <MenuItem key={t} value={t}>
                        {t}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControlLabel control={<Switch name="disponible" checked={form.disponible} onChange={onChange} />} label="Disponible" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel control={<Switch name="categoriaDestacada" checked={form.categoriaDestacada} onChange={(e) => {
                  const checked = e.target.checked;
                  setForm(prev => ({ ...prev, categoriaDestacada: checked, tags: checked ? Array.from(new Set([...(prev.tags || []), 'destacadas'])) : (prev.tags || []).filter(x => x !== 'destacadas') }));
                }} />} label="Destacada" />
              </Grid>

              <Grid item xs={12}>
                { (imageFile || form.Imagen) && (
                  <img src={imageFile ? URL.createObjectURL(imageFile) : form.Imagen} alt="preview" style={{ height: 110, borderRadius: 8, marginBottom: 8 }} />
                )}
                <Button variant="outlined" component="label">
                  {imageFile ? `Imagen: ${imageFile.name}` : (form.Imagen ? 'Cambiar imagen' : 'Subir imagen')}
                  <input hidden type="file" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                </Button>
                {isSuper && !editing && !imageFile && (
                  <Typography variant="caption" sx={{ ml: 1 }} color="error">* Obligatoria para supermercados</Typography>
                )}
              </Grid>

              {isSuper && (
                <>
                  <Grid item xs={12}><Divider>Subcategorías</Divider></Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField label="Nueva subcategoría" value={form._newSubcat || ''} onChange={(e) => setForm(p => ({ ...p, _newSubcat: e.target.value }))} fullWidth />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Button startIcon={<AddIcon />} onClick={addSubcat}>Añadir</Button>
                  </Grid>
                  <Grid item xs={12}>
                    {(form.subCategoriasText || []).map(sc => (
                      <Chip key={sc} label={sc} onDelete={sc === 'Todos' ? undefined : () => removeSubcat(sc)} sx={{ mr: 1, mb: 1 }} />
                    ))}
                  </Grid>
                </>
              )}
            </Grid>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, pt: 2 }}>
            <Button onClick={handleClose}>Cancelar</Button>
            <Button variant="contained" onClick={saveCategory}>{editing ? 'Guardar cambios' : 'Guardar'}</Button>
          </Box>
        </Box>
      </Modal>
    </Box>
  );
}