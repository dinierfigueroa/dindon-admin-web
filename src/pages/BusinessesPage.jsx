import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db, storage } from '../firebase/config';
import {
  collection, getDocs, query, addDoc, doc, updateDoc, deleteDoc,
  GeoPoint, getDoc, Timestamp, writeBatch, orderBy
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate, useSearchParams } from 'react-router-dom';

// DnD
import { DndContext, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// MUI
import Tab from '@mui/material/Tab';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Typography, Box, Switch, FormControl, InputLabel, Select, MenuItem, Grid,
  Button, Modal, TextField, FormControlLabel, Divider, OutlinedInput, Checkbox,
  IconButton, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import CategoryIcon from '@mui/icons-material/Category';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';

const style = {
  position: 'absolute',
  top: '50%', left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 800, bgcolor: 'background.paper',
  border: '2px solid #000', boxShadow: 24,
  p: 4, display: 'flex', flexDirection: 'column',
  maxHeight: '90vh'
};

const tagOptions = ['promociones', 'destacados', 'populares', 'internacionales', 'patrocinados', 'nuevos'];
const dayOptions = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

const initialFormData = {
  NombredelNegocio: '', identificador: '', categoriaTexto: '', subCategoria: '', tags: [],
  compraMinima: 0, posicion: 0, ciudad: '', colonia: '', Direccion: '', latitud: '', longitud: '',
  mostrar: true, AbiertooCerrado: true, recibePagosOnline: false, sepuederecoger: false,
  tiene_entrega_prioritaria: false, precio_entrega_prioritaria: 0, descripcionEntregaPrioritaria: '',
  tieneMensaje: false, mensajeNuevo: '', mostrarComoSuper: false,
  colorFondoDestacados: '#FFFFFF', colorFondoPromociones: '#FFFFFF', horarioTienda: [],
  costoBase: 0, costoPorKm: 0, distanciaMinimaGratis: 0, promocionEnvioGratisActive: false,
  nombrePromocionEnvioGratis: '', fechaFinPromocionEnvioGratis: '',
  envioGratisPorMontoMinimo: { activo: false, montoMinimo: 0, mensajePromocional: '' },
  descuentoFijoEnvio: { activo: false, cantidadDescuento: 0, montoMinimoParaAplicar: 0, mensajePromocional: '' },
  tiempoPromedioEstimado: { tiempoPreparacionMin: 0, tiempoPreparacionMax: 0, velocidadEntregaKmPorMin: 0, tiempoAdicionalFijoMin: 0 },
};

const PageContext = React.createContext({});

// --- FUNCIÓN AUXILIAR PARA GENERAR KEYWORDS ---
const generateSearchKeywords = (name) => {
  if (!name) return [];
  const lowerCaseName = name.toLowerCase();
  const keywords = new Set();
  // Generar prefijos
  for (let i = 1; i <= lowerCaseName.length; i++) {
    keywords.add(lowerCaseName.substring(0, i));
  }
  // Añadir palabras completas
  lowerCaseName.split(' ').forEach(word => {
    if(word) keywords.add(word);
  });
  return Array.from(keywords);
};

function SortableBusinessRow({ business }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: business.firestoreId,
    disabled: !business.mostrar
  });
  const rowStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: business.mostrar ? 1 : 0.6
  };
  const navigate = useNavigate();
  const { handleEditClick, handleDeleteClick } = React.useContext(PageContext);

  return (
    <TableRow ref={setNodeRef} style={rowStyle}>
      <TableCell
        {...listeners}
        {...attributes}
        sx={{ cursor: business.mostrar ? 'grab' : 'not-allowed', width: 50 }}
      >
        <DragIndicatorIcon />
      </TableCell>
      <TableCell>
        <Box
          component="img"
          sx={{ height: 50, width: 50, borderRadius: '4px', objectFit: 'cover' }}
          alt={business.NombredelNegocio}
          src={business.Imagen}
        />
      </TableCell>
      <TableCell>{business.NombredelNegocio}</TableCell>
      <TableCell>{business.ciudad}</TableCell>
      <TableCell>{business.posicion}</TableCell>
      <TableCell><Switch checked={business.mostrar} readOnly /></TableCell>
      <TableCell><Switch checked={business.AbiertooCerrado} color="success" readOnly /></TableCell>
      <TableCell align="right">
        <IconButton
          title="Gestionar Productos"
          onClick={(e) => { e.stopPropagation(); navigate(`/negocios/${business.uuidEmpresa}/productos`); }}
        >
          <ShoppingCartIcon />
        </IconButton>
        <IconButton
          title="Gestionar Categorías"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/negocios/${business.uuidEmpresa}/categorias`); }}
        >
          <CategoryIcon />
        </IconButton>
        <IconButton
          color="primary"
          title="Editar Negocio"
          onClick={(e) => { e.stopPropagation(); handleEditClick(business); }}
        >
          <EditIcon />
        </IconButton>
        <IconButton
          color="error"
          title="Eliminar Negocio"
          onClick={(e) => { e.stopPropagation(); handleDeleteClick(business); }}
        >
          <DeleteIcon />
        </IconButton>
      </TableCell>
    </TableRow>
  );
}

export default function BusinessesPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [filterCity, setFilterCity] = useState(searchParams.get('city') || 'JUTICALPA');
  const [filterCategory, setFilterCategory] = useState(searchParams.get('cat') || 'Restaurantes');
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || 'activos');
  const [search, setSearch] = useState(searchParams.get('q') || '');

  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [tabValue, setTabValue] = useState('1');
  const [isSaving, setIsSaving] = useState(false);
  const [marketplaceCategories, setMarketplaceCategories] = useState([]);
  const [cities, setCities] = useState([]);
  const [formData, setFormData] = useState(initialFormData);
  const [mainImageFile, setMainImageFile] = useState(null);
  const [bannerImageFile, setBannerImageFile] = useState(null);
  const [editingBusiness, setEditingBusiness] = useState(null);
  const [businessToDelete, setBusinessToDelete] = useState(null);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const businessesQuery = query(collection(db, 'NegociosAfiliados'), orderBy('posicion', 'asc'));
      const businessesSnapshot = await getDocs(businessesQuery);
      setBusinesses(businessesSnapshot.docs.map(d => ({ firestoreId: d.id, ...d.data() })));

      const marketplaceQuery = query(collection(db, 'marketplace'));
      const marketplaceSnapshot = await getDocs(marketplaceQuery);
      setMarketplaceCategories(marketplaceSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));

      const citiesQuery = query(collection(db, 'cities'));
      const citiesSnapshot = await getDocs(citiesQuery);
      setCities(citiesSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error al obtener datos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const setOrDelete = (key, val, def) => {
      if (!val || val === def) params.delete(key);
      else params.set(key, val);
    };
    setOrDelete('city',   filterCity,    'JUTICALPA');
    setOrDelete('cat',    filterCategory,'Restaurantes');
    setOrDelete('status', filterStatus,  'activos');
    setOrDelete('q',      search,        '');
    if (params.toString() !== searchParams.toString()) setSearchParams(params, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCity, filterCategory, filterStatus, search]);

  const resetFormAndCloseModal = useCallback(() => {
    setFormData(initialFormData);
    setMainImageFile(null);
    setBannerImageFile(null);
    setEditingBusiness(null);
    setOpenModal(false);
    setTabValue('1');
  }, []);

  const handleAddNewClick = useCallback(() => {
    resetFormAndCloseModal();
    setFormData(prev => ({ ...prev, posicion: businesses.length + 1 }));
    setOpenModal(true);
  }, [businesses.length, resetFormAndCloseModal]);

  const handleEditClick = useCallback(async (business) => {
    setEditingBusiness(business);
    let shippingConfigData = {};
    if (business.configuracionEnvios && business.configuracionEnvios.id) {
      try {
        const shippingDoc = await getDoc(business.configuracionEnvios);
        if (shippingDoc.exists()) {
          const data = shippingDoc.data();
          if (data.fechaFinPromocionEnvioGratis?.toDate) {
            data.fechaFinPromocionEnvioGratis = data.fechaFinPromocionEnvioGratis
              .toDate().toISOString().split('T')[0];
          }
          shippingConfigData = data;
        }
      } catch (e) {
        console.error('Error fetching shipping config:', e);
      }
    }
    const lat = business.ubicacion?.latitude || '';
    const lng = business.ubicacion?.longitude || '';
    const formattedHorario = business.horarioTienda?.map(h => ({
      ...h,
      diaSemana: h.diaSemana.toLowerCase(),
      horaApertura: h.horaApertura?.toDate?.().toTimeString().substring(0, 5) || '',
      horaCierre: h.horaCierre?.toDate?.().toTimeString().substring(0, 5) || '',
    })) || [];
    setFormData({
      ...initialFormData,
      ...business,
      ...shippingConfigData,
      latitud: lat,
      longitud: lng,
      horarioTienda: formattedHorario
    });
    setTabValue('1');
    setOpenModal(true);
  }, []);

  const handleDeleteClick = useCallback((business) => {
    setBusinessToDelete(business);
    setOpenDeleteDialog(true);
  }, []);
  const handleCloseDeleteDialog = useCallback(() => {
    setOpenDeleteDialog(false);
    setBusinessToDelete(null);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!businessToDelete) return;
    setIsDeleting(true);
    try {
      if (businessToDelete.Imagen) {
        await deleteObject(ref(storage, businessToDelete.Imagen)).catch(() => {});
      }
      if (businessToDelete.imagenBanner) {
        await deleteObject(ref(storage, businessToDelete.imagenBanner)).catch(() => {});
      }
      if (businessToDelete.configuracionEnvios?.id) {
        await deleteDoc(doc(db, 'configuracionEnvios', businessToDelete.configuracionEnvios.id));
      }
      await deleteDoc(doc(db, 'NegociosAfiliados', businessToDelete.firestoreId));
      handleCloseDeleteDialog();
      fetchData();
      alert('Negocio eliminado con éxito');
    } catch (error) {
      console.error('Error al eliminar negocio:', error);
      alert('Error al eliminar el negocio.');
    } finally {
      setIsDeleting(false);
    }
  }, [businessToDelete, fetchData, handleCloseDeleteDialog]);

  const handleTabChange = useCallback((_, v) => setTabValue(v), []);
  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }, []);
  const handleNestedChange = useCallback((group, e) => {
    const { name, value, type, checked } = e.target;
    const processedValue = type === 'number' ? parseFloat(value) || 0 : value;
    setFormData(prev => ({ ...prev, [group]: { ...prev[group], [name]: type === 'checkbox' ? checked : processedValue } }));
  }, []);
  const handleAddHorario = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      horarioTienda: [...(prev.horarioTienda || []), { diaSemana: 'lunes', horaApertura: '08:00', horaCierre: '17:00' }]
    }));
  }, []);
  const handleHorarioChange = useCallback((index, e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = [...prev.horarioTienda];
      updated[index][name] = value;
      return { ...prev, horarioTienda: updated };
    });
  }, []);
  const handleRemoveHorario = useCallback((index) => {
    setFormData(prev => ({ ...prev, horarioTienda: prev.horarioTienda.filter((_, i) => i !== index) }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!formData.NombredelNegocio) {
      alert('El nombre es obligatorio.');
      return;
    }
    setIsSaving(true);
    try {
      const uuidEmpresa = editingBusiness ? editingBusiness.uuidEmpresa : uuidv4();
      const uploadImage = async (file, path) => {
        if (!file) return null;
        const storageRef = ref(storage, `${path}/${uuidEmpresa}/${file.name}-${Date.now()}`);
        await uploadBytes(storageRef, file);
        return await getDownloadURL(storageRef);
      };
      const mainImageUrl = await uploadImage(mainImageFile, 'business_images');
      const bannerImageUrl = await uploadImage(bannerImageFile, 'business_banners');

      const convertTimeStringToTimestamp = (timeString) => {
        if (!timeString || typeof timeString !== 'string') return null;
        const [hours, minutes] = timeString.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) return null;
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        return Timestamp.fromDate(date);
      };

      const finalHorarioTienda = (formData.horarioTienda || []).map(h => ({
        diaSemana: h.diaSemana.toLowerCase(),
        horaApertura: convertTimeStringToTimestamp(h.horaApertura),
        horaCierre: convertTimeStringToTimestamp(h.horaCierre)
      }));

      const businessDataForSave = {
        NombredelNegocio: formData.NombredelNegocio,
        identificador: formData.identificador,
        uuidEmpresa,
        Imagen: mainImageUrl || (editingBusiness ? editingBusiness.Imagen : ''),
        imagenBanner: bannerImageUrl || (editingBusiness ? editingBusiness.imagenBanner : ''),
        ciudad: formData.ciudad, colonia: formData.colonia, Direccion: formData.Direccion,
        ubicacion: new GeoPoint(parseFloat(formData.latitud) || 0, parseFloat(formData.longitud) || 0),
        mostrar: formData.mostrar, AbiertooCerrado: formData.AbiertooCerrado, recibePagosOnline: formData.recibePagosOnline,
        tiene_entrega_prioritaria: formData.tiene_entrega_prioritaria,
        precio_entrega_prioritaria: Number(formData.precio_entrega_prioritaria) || 0,
        descripcionEntregaPrioritaria: formData.descripcionEntregaPrioritaria,
        sepuederecoger: formData.sepuederecoger, tieneMensaje: formData.tieneMensaje, mensajeNuevo: formData.mensajeNuevo,
        compraMinima: Number(formData.compraMinima) || 0, posicion: Number(formData.posicion) || 0,
        categoriaTexto: formData.categoriaTexto, subCategoria: formData.subCategoria, tags: formData.tags,
        mostrarComoSuper: formData.mostrarComoSuper, horarioTienda: finalHorarioTienda,
        colorFondoDestacados: formData.colorFondoDestacados, colorFondoPromociones: formData.colorFondoPromociones,
        searchKeywords: generateSearchKeywords(formData.NombredelNegocio), // <-- CAMPO AÑADIDO
      };

      const shippingDataForSave = {
        uuidEmpresa,
        costoBase: Number(formData.costoBase) || 0,
        costoPorKm: Number(formData.costoPorKm) || 0,
        distanciaMinimaGratis: Number(formData.distanciaMinimaGratis) || 0,
        promocionEnvioGratisActive: formData.promocionEnvioGratisActive,
        nombrePromocionEnvioGratis: formData.nombrePromocionEnvioGratis,
        fechaFinPromocionEnvioGratis: formData.fechaFinPromocionEnvioGratis
          ? Timestamp.fromDate(new Date(formData.fechaFinPromocionEnvioGratis))
          : null,
        envioGratisPorMontoMinimo: formData.envioGratisPorMontoMinimo,
        descuentoFijoEnvio: formData.descuentoFijoEnvio,
        tiempoPromedioEstimado: formData.tiempoPromedioEstimado
      };

      if (editingBusiness) {
        const businessDocRef = doc(db, 'NegociosAfiliados', editingBusiness.firestoreId);
        await updateDoc(businessDocRef, businessDataForSave);
        if (editingBusiness.configuracionEnvios?.id) {
          const shippingDocRef = doc(db, 'configuracionEnvios', editingBusiness.configuracionEnvios.id);
          await updateDoc(shippingDocRef, { ...shippingDataForSave, idNegocio: businessDocRef });
        } else {
          const shippingDocRef = await addDoc(collection(db, 'configuracionEnvios'), { ...shippingDataForSave, idNegocio: businessDocRef });
          await updateDoc(businessDocRef, { configuracionEnvios: shippingDocRef });
        }
      } else {
        const businessDocRef = await addDoc(collection(db, 'NegociosAfiliados'), {
          ...businessDataForSave, configuracionEnvios: null
        });
        const shippingDocRef = await addDoc(collection(db, 'configuracionEnvios'), {
          ...shippingDataForSave, idNegocio: businessDocRef
        });
        await updateDoc(businessDocRef, { configuracionEnvios: shippingDocRef });
      }

      resetFormAndCloseModal();
      fetchData();
      alert(`¡Negocio ${editingBusiness ? 'actualizado' : 'guardado'} con éxito!`);
    } catch (error) {
      console.error('Error al guardar:', error);
      alert('Hubo un error al guardar. Revisa la consola.');
    } finally {
      setIsSaving(false);
    }
  }, [formData, editingBusiness, mainImageFile, bannerImageFile, fetchData, resetFormAndCloseModal, businesses.length]);

  const cityOptions = useMemo(() => {
    const citiesData = businesses.map(b => b.ciudad);
    return ['Todas', ...new Set(citiesData)];
  }, [businesses]);
  const categoryOptions = useMemo(() => {
    const categoriesData = businesses.map(b => b.categoriaTexto);
    return ['Todas', ...new Set(categoriesData)];
  }, [businesses]);

  const filteredBusinesses = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const sorted = [...businesses].sort((a, b) =>
      (a.mostrar === b.mostrar) ? ((a.posicion || 0) - (b.posicion || 0)) : (a.mostrar ? -1 : 1)
    );
    return sorted.filter(b => {
      if (filterCity && filterCity !== 'Todas' && b.ciudad !== filterCity) return false;
      if (filterCategory && filterCategory !== 'Todas' && b.categoriaTexto !== filterCategory) return false;
      if (filterStatus === 'activos' && !b.mostrar) return false;
      if (filterStatus === 'inactivos' && b.mostrar) return false;
      // --- LÓGICA DE BÚSQUEDA ACTUALIZADA ---
      if (needle && !(b.NombredelNegocio || '').toLowerCase().includes(needle) && !b.searchKeywords?.includes(needle)) return false;
      return true;
    });
  }, [businesses, filterCity, filterCategory, filterStatus, search]);

  const subCategoryOptions = useMemo(() => {
    if (!formData.categoriaTexto) return [];
    const selectedCategory = marketplaceCategories.find(cat => cat.categorieName === formData.categoriaTexto);
    return selectedCategory?.subcategorias || [];
  }, [formData.categoriaTexto, marketplaceCategories]);

  const handleDragEnd = useCallback(async ({ active, over }) => {
    if (!over || active.id === over.id) return;

    const activeList = filteredBusinesses.filter(b => b.mostrar);
    const oldIndex = activeList.findIndex(b => b.firestoreId === active.id);
    const newIndex = activeList.findIndex(b => b.firestoreId === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedList = arrayMove(activeList, oldIndex, newIndex);

    const updatedBusinesses = businesses.map(b => {
      const found = reorderedList.find(r => r.firestoreId === b.firestoreId);
      if (found) {
        const newPos = reorderedList.findIndex(r => r.firestoreId === b.firestoreId) + 1;
        return { ...b, posicion: newPos };
      }
      return b;
    });
    setBusinesses(updatedBusinesses);

    try {
      const batch = writeBatch(db);
      reorderedList.forEach((b, idx) => {
        const newPosition = idx + 1;
        if (b.posicion !== newPosition) {
          batch.update(doc(db, 'NegociosAfiliados', b.firestoreId), { posicion: newPosition });
        }
      });
      await batch.commit();
      await fetchData();
    } catch (error) {
      console.error('Error al actualizar posiciones:', error);
      alert('Hubo un error al guardar el nuevo orden.');
      fetchData();
    }
  }, [filteredBusinesses, businesses, fetchData]);

  if (loading) return <Typography>Cargando negocios...</Typography>;

  return (
    <PageContext.Provider value={{ handleEditClick, handleDeleteClick }}>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" gutterBottom>Gestión de Negocios Afiliados</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddNewClick}>
            Agregar Negocio
          </Button>
        </Box>

        <Paper sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth>
                <InputLabel>Filtrar por Ciudad</InputLabel>
                <Select value={filterCity} label="Filtrar por Ciudad" onChange={(e) => setFilterCity(e.target.value)}>
                  {cityOptions.map(city => <MenuItem key={city} value={city}>{city}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth>
                <InputLabel>Filtrar por Categoría</InputLabel>
                <Select value={filterCategory} label="Filtrar por Categoría" onChange={(e) => setFilterCategory(e.target.value)}>
                  {categoryOptions.map(cat => <MenuItem key={cat} value={cat}>{cat}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth>
                <InputLabel>Filtrar por Estado</InputLabel>
                <Select value={filterStatus} label="Filtrar por Estado" onChange={(e) => setFilterStatus(e.target.value)}>
                  <MenuItem value="">Todos</MenuItem>
                  <MenuItem value="activos">Activos (Mostrando)</MenuItem>
                  <MenuItem value="inactivos">Inactivos (Ocultos)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField 
                fullWidth 
                label="Buscar por nombre..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
              />
            </Grid>
          </Grid>
        </Paper>

        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 50 }} />
                  <TableCell>Imagen</TableCell>
                  <TableCell>Nombre</TableCell>
                  <TableCell>Ciudad</TableCell>
                  <TableCell>Posición</TableCell>
                  <TableCell>Mostrar</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <SortableContext items={filteredBusinesses.map(b => b.firestoreId)} strategy={verticalListSortingStrategy}>
                <TableBody>
                  {filteredBusinesses.map((business) => (
                    <SortableBusinessRow key={business.firestoreId} business={business} />
                  ))}
                </TableBody>
              </SortableContext>
            </Table>
          </TableContainer>
        </DndContext>

        <Modal open={openModal} onClose={resetFormAndCloseModal}>
          <Box sx={style}>
            <Typography variant="h6">{editingBusiness ? 'Editar Negocio' : 'Agregar Nuevo Negocio'}</Typography>
            <Box sx={{ flexGrow: 1, overflowY: 'auto', pr: 2 }}>
              <TabContext value={tabValue}>
                <Box sx={{ borderBottom: 1, borderColor: 'divider', position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 1 }}>
                  <TabList onChange={handleTabChange}>
                    <Tab label="Info General" value="1" /> <Tab label="Ubicación" value="2" /> <Tab label="Envíos" value="3" />
                    <Tab label="Horarios" value="4" /> <Tab label="Configuración" value="5" />
                  </TabList>
                </Box>
                <TabPanel value="1">
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}><TextField name="NombredelNegocio" label="Nombre del Negocio" fullWidth value={formData.NombredelNegocio} onChange={handleChange} /></Grid>
                    <Grid item xs={12} sm={6}><TextField name="identificador" label="Identificador" fullWidth value={formData.identificador} onChange={handleChange} /></Grid>
                    <Grid item xs={12} sm={6}><TextField name="compraMinima" label="Compra Mínima (L.)" type="number" fullWidth value={formData.compraMinima} onChange={handleChange} /></Grid>
                    <Grid item xs={12} sm={6}><TextField name="posicion" label="Posición" type="number" fullWidth value={formData.posicion} onChange={handleChange} /></Grid>
                    <Grid item xs={12} sm={6}><FormControl fullWidth><InputLabel>Categoría Principal</InputLabel><Select name="categoriaTexto" value={formData.categoriaTexto} label="Categoría Principal" onChange={handleChange}>{marketplaceCategories.map(cat => <MenuItem key={cat.id} value={cat.categorieName}>{cat.categorieName}</MenuItem>)}</Select></FormControl></Grid>
                    <Grid item xs={12} sm={6}><FormControl fullWidth disabled={!formData.categoriaTexto}><InputLabel>Subcategorías</InputLabel><Select name="subCategoria" value={formData.subCategoria} label="Subcategorías" onChange={handleChange}>{subCategoryOptions.map(sub => <MenuItem key={sub.nombre} value={sub.nombre}>{sub.nombre}</MenuItem>)}</Select></FormControl></Grid>
                    <Grid item xs={12}><FormControl fullWidth><InputLabel>Tags</InputLabel><Select multiple name="tags" value={formData.tags} onChange={handleChange} input={<OutlinedInput label="Tags" />} renderValue={(selected) => selected.join(', ')}>{tagOptions.map((tag) => (<MenuItem key={tag} value={tag}><Checkbox checked={formData.tags.indexOf(tag) > -1} />{tag}</MenuItem>))}</Select></FormControl></Grid>
                    <Grid item xs={12} sm={6}><Button variant="outlined" component="label" fullWidth>{mainImageFile ? `Archivo: ${mainImageFile.name}` : 'Subir Imagen Principal'}<input type="file" hidden onChange={e => setMainImageFile(e.target.files[0])} /></Button></Grid>
                    <Grid item xs={12} sm={6}><Button variant="outlined" component="label" fullWidth>{bannerImageFile ? `Archivo: ${bannerImageFile.name}` : 'Subir Imagen Banner'}<input type="file" hidden onChange={e => setBannerImageFile(e.target.files[0])} /></Button></Grid>
                  </Grid>
                </TabPanel>
                <TabPanel value="2">
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}><FormControl fullWidth><InputLabel>Ciudad</InputLabel><Select name="ciudad" value={formData.ciudad} label="Ciudad" onChange={handleChange}>{cities.map(city => <MenuItem key={city.id} value={city.nombreCiudad}>{city.nombreCiudad}</MenuItem>)}</Select></FormControl></Grid>
                    <Grid item xs={12} sm={6}><TextField name="colonia" label="Colonia" fullWidth value={formData.colonia} onChange={handleChange} /></Grid>
                    <Grid item xs={12}><TextField name="Direccion" label="Dirección Completa" fullWidth multiline rows={3} value={formData.Direccion} onChange={handleChange} /></Grid>
                    <Grid item xs={12}><Divider>Ubicación en Mapa</Divider></Grid>
                    <Grid item xs={12} sm={6}><TextField name="latitud" label="Latitud" type="text" fullWidth value={formData.latitud} onChange={handleChange} /></Grid>
                    <Grid item xs={12} sm={6}><TextField name="longitud" label="Longitud" type="text" fullWidth value={formData.longitud} onChange={handleChange} /></Grid>
                  </Grid>
                </TabPanel>
                <TabPanel value="3">
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}><TextField name="costoBase" label="Costo Base de Envío" type="number" fullWidth value={formData.costoBase} onChange={handleChange} /></Grid>
                    <Grid item xs={12} sm={6}><TextField name="costoPorKm" label="Costo por Km" type="number" fullWidth value={formData.costoPorKm} onChange={handleChange} /></Grid>
                    <Grid item xs={12}><TextField name="distanciaMinimaGratis" label="Distancia Mínima Gratis (Km)" type="number" fullWidth value={formData.distanciaMinimaGratis} onChange={handleChange} /></Grid>
                    <Grid item xs={12}><Divider sx={{ my: 2 }}>Promoción de Envío</Divider></Grid>
                    <Grid item xs={12}><FormControlLabel control={<Switch name="promocionEnvioGratisActive" checked={formData.promocionEnvioGratisActive} onChange={handleChange} />} label="Activar promoción de envío" /></Grid>
                    <Grid item xs={12} sm={6}><TextField name="nombrePromocionEnvioGratis" label="Nombre de la Promoción" fullWidth value={formData.nombrePromocionEnvioGratis} onChange={handleChange} /></Grid>
                    <Grid item xs={12} sm={6}><TextField name="fechaFinPromocionEnvioGratis" label="Fecha Fin de Promoción" type="date" fullWidth value={formData.fechaFinPromocionEnvioGratis} onChange={handleChange} InputLabelProps={{ shrink: true }}/></Grid>
                    <Grid item xs={12}><Divider sx={{ my: 1 }}>Tiempo Promedio Estimado</Divider></Grid>
                    <Grid item xs={6} sm={3}><TextField name="tiempoPreparacionMin" label="Prep. Mín (min)" type="number" value={formData.tiempoPromedioEstimado.tiempoPreparacionMin} onChange={e => handleNestedChange('tiempoPromedioEstimado', e)} /></Grid>
                    <Grid item xs={6} sm={3}><TextField name="tiempoPreparacionMax" label="Prep. Máx (min)" type="number" value={formData.tiempoPromedioEstimado.tiempoPreparacionMax} onChange={e => handleNestedChange('tiempoPromedioEstimado', e)} /></Grid>
                    <Grid item xs={6} sm={3}><TextField name="velocidadEntregaKmPorMin" label="Velocidad (min/km)" type="number" value={formData.tiempoPromedioEstimado.velocidadEntregaKmPorMin} onChange={e => handleNestedChange('tiempoPromedioEstimado', e)} /></Grid>
                    <Grid item xs={6} sm={3}><TextField name="tiempoAdicionalFijoMin" label="Adicional Fijo (min)" type="number" value={formData.tiempoPromedioEstimado.tiempoAdicionalFijoMin} onChange={e => handleNestedChange('tiempoPromedioEstimado', e)} /></Grid>
                    <Grid item xs={12}><Divider sx={{ my: 1 }}>Envío Gratis por Monto</Divider></Grid>
                    <Grid item xs={12}><FormControlLabel control={<Switch name="activo" checked={formData.envioGratisPorMontoMinimo.activo} onChange={e => handleNestedChange('envioGratisPorMontoMinimo', e)} />} label="Activar" /></Grid>
                    <Grid item xs={12} sm={6}><TextField name="montoMinimo" label="Monto Mínimo" type="number" fullWidth disabled={!formData.envioGratisPorMontoMinimo.activo} value={formData.envioGratisPorMontoMinimo.montoMinimo} onChange={e => handleNestedChange('envioGratisPorMontoMinimo', e)} /></Grid>
                    <Grid item xs={12} sm={6}><TextField name="mensajePromocional" label="Mensaje Promocional" fullWidth disabled={!formData.envioGratisPorMontoMinimo.activo} value={formData.envioGratisPorMontoMinimo.mensajePromocional} onChange={e => handleNestedChange('envioGratisPorMontoMinimo', e)} /></Grid>
                    <Grid item xs={12}><Divider sx={{ my: 1 }}>Descuento Fijo en Envío</Divider></Grid>
                    <Grid item xs={12}><FormControlLabel control={<Switch name="activo" checked={formData.descuentoFijoEnvio.activo} onChange={e => handleNestedChange('descuentoFijoEnvio', e)} />} label="Activar Descuento Fijo" /></Grid>
                    <Grid item xs={12} sm={4}><TextField name="cantidadDescuento" label="Cantidad Descuento" type="number" fullWidth disabled={!formData.descuentoFijoEnvio.activo} value={formData.descuentoFijoEnvio.cantidadDescuento} onChange={e => handleNestedChange('descuentoFijoEnvio', e)} /></Grid>
                    <Grid item xs={12} sm={4}><TextField name="montoMinimoParaAplicar" label="Monto Mínimo Aplicar" type="number" fullWidth disabled={!formData.descuentoFijoEnvio.activo} value={formData.descuentoFijoEnvio.montoMinimoParaAplicar} onChange={e => handleNestedChange('descuentoFijoEnvio', e)} /></Grid>
                    <Grid item xs={12} sm={4}><TextField name="mensajePromocional" label="Mensaje Promocional" fullWidth disabled={!formData.descuentoFijoEnvio.activo} value={formData.descuentoFijoEnvio.mensajePromocional} onChange={e => handleNestedChange('descuentoFijoEnvio', e)} /></Grid>
                  </Grid>
                </TabPanel>
                <TabPanel value="4">
                    <Button startIcon={<AddIcon />} onClick={handleAddHorario}>Añadir Horario</Button>
                    {formData.horarioTienda?.map((horario, index) => (
                        <Grid container spacing={1} key={index} sx={{mt: 1, alignItems: 'center'}}>
                            <Grid item xs={4}><FormControl fullWidth><InputLabel>Día</InputLabel><Select name="diaSemana" value={horario.diaSemana} onChange={(e) => handleHorarioChange(index, e)}>{dayOptions.map(d => <MenuItem key={d} value={d} sx={{textTransform: 'capitalize'}}>{d}</MenuItem>)}</Select></FormControl></Grid>
                            <Grid item xs={3}><TextField name="horaApertura" label="Apertura" type="time" value={horario.horaApertura} onChange={(e) => handleHorarioChange(index, e)} fullWidth InputLabelProps={{ shrink: true }} /></Grid>
                            <Grid item xs={3}><TextField name="horaCierre" label="Cierre" type="time" value={horario.horaCierre} onChange={(e) => handleHorarioChange(index, e)} fullWidth InputLabelProps={{ shrink: true }} /></Grid>
                            <Grid item xs={2}><IconButton color="error" onClick={() => handleRemoveHorario(index)}><DeleteIcon /></IconButton></Grid>
                        </Grid>
                    ))}
                </TabPanel>
                <TabPanel value="5">
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <TextField label="Color Fondo Destacados" name="colorFondoDestacados" type="color" value={formData.colorFondoDestacados} onChange={handleChange} fullWidth sx={{mb: 2}} InputLabelProps={{ shrink: true }} />
                        <TextField label="Color Fondo Promociones" name="colorFondoPromociones" type="color" value={formData.colorFondoPromociones} onChange={handleChange} fullWidth InputLabelProps={{ shrink: true }} />
                        <Divider sx={{ my: 1 }} />
                        <FormControlLabel control={<Switch name="mostrar" checked={formData.mostrar} onChange={handleChange} />} label="Mostrar negocio en la App" />
                        <FormControlLabel control={<Switch name="AbiertooCerrado" checked={formData.AbiertooCerrado} onChange={handleChange} />} label="Marcar como Abierto (manual)" />
                        <FormControlLabel control={<Switch name="recibePagosOnline" checked={formData.recibePagosOnline} onChange={handleChange} />} label="Recibe Pagos Online" />
                        <FormControlLabel control={<Switch name="sepuederecoger" checked={formData.sepuederecoger} onChange={handleChange} />} label="Se puede recoger en tienda" />
                        <FormControlLabel control={<Switch name="mostrarComoSuper" checked={formData.mostrarComoSuper} onChange={handleChange} />} label="Mostrar como Supermercado" />
                        <Divider sx={{ my: 1 }} />
                        <FormControlLabel control={<Switch name="tiene_entrega_prioritaria" checked={formData.tiene_entrega_prioritaria} onChange={handleChange} />} label="Tiene entrega prioritaria" />
                        <TextField name="precio_entrega_prioritaria" label="Precio Entrega Prioritaria" type="number" fullWidth sx={{ my: 1 }} disabled={!formData.tiene_entrega_prioritaria} value={formData.precio_entrega_prioritaria} onChange={handleChange} />
                        <TextField name="descripcionEntregaPrioritaria" label="Descripción Entrega Prioritaria" fullWidth multiline rows={2} disabled={!formData.tiene_entrega_prioritaria} value={formData.descripcionEntregaPrioritaria} onChange={handleChange} />
                        <Divider sx={{ my: 1 }} />
                        <FormControlLabel control={<Switch name="tieneMensaje" checked={formData.tieneMensaje} onChange={handleChange} />} label="Tiene mensaje especial (ej. 'NUEVO')" />
                        <TextField name="mensajeNuevo" label="Mensaje Especial" fullWidth disabled={!formData.tieneMensaje} value={formData.mensajeNuevo} onChange={handleChange} />
                    </Box>
                </TabPanel>
              </TabContext>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, pt: 2, mt: 'auto' }}>
                <Button onClick={resetFormAndCloseModal}>Cancelar</Button>
                <Button variant="contained" onClick={handleSave} disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar'}</Button>
            </Box>
          </Box>
        </Modal>

        <Dialog open={openDeleteDialog} onClose={handleCloseDeleteDialog}>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogContent><DialogContentText>¿Estás seguro de que quieres eliminar este negocio? Se borrarán también sus datos de envío.</DialogContentText></DialogContent>
            <DialogActions><Button onClick={handleCloseDeleteDialog}>Cancelar</Button><Button onClick={handleConfirmDelete} color="error" disabled={isDeleting}>{isDeleting ? 'Eliminando...' : 'Eliminar'}</Button></DialogActions>
        </Dialog>
      </Box>
    </PageContext.Provider>
  );
}