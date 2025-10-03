import React, { useState, useEffect } from 'react';
import { db, storage } from '../firebase/config';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, writeBatch, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Typography, Box, Button, Modal, TextField, Switch, FormControlLabel,
  FormControl, InputLabel, Select, MenuItem, OutlinedInput, Checkbox,
  IconButton, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  Divider
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';

const style = {
  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
  width: 500,
  bgcolor: 'background.paper', border: '2px solid #000',
  boxShadow: 24, p: 4, display: 'flex', flexDirection: 'column', gap: 2,
  maxHeight: '90vh', overflowY: 'auto'
};

const PageContext = React.createContext({});

const SortableCategoryRow = ({ category }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: category.firestoreId });
  const rowStyle = { transform: CSS.Transform.toString(transform), transition };
  const { handleEditClick, handleDeleteClick } = React.useContext(PageContext);

  return (
    <TableRow ref={setNodeRef} style={rowStyle} {...attributes}>
      <TableCell {...listeners} sx={{ cursor: 'grab' }}><DragIndicatorIcon /></TableCell>
      <TableCell><Box component="img" sx={{ height: 50, width: 50, borderRadius: '4px', objectFit: 'cover' }} alt={category.categorieName} src={category.image} /></TableCell>
      <TableCell component="th" scope="row">{category.categorieName}</TableCell>
      <TableCell>{category.visible ? 'Sí' : 'No'}</TableCell>
      <TableCell>{category.position}</TableCell>
      <TableCell align="right">
        <IconButton color="primary" onClick={() => handleEditClick(category)}><EditIcon /></IconButton>
        <IconButton color="error" onClick={() => handleDeleteClick(category)}><DeleteIcon /></IconButton>
      </TableCell>
    </TableRow>
  );
};

function MarketplacePage() {
  const [categories, setCategories] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formName, setFormName] = useState('');
  const [formCities, setFormCities] = useState([]);
  const [formVisible, setFormVisible] = useState(true);
  const [formImage, setFormImage] = useState(null);
  const [formPosition, setFormPosition] = useState(0);
  const [formSubcategories, setFormSubcategories] = useState([]);

  const fetchData = async () => {
    if (!loading) setLoading(true);
    try {
      const categoriesQuery = query(collection(db, 'marketplace'), orderBy("position", "asc"));
      const categoriesSnapshot = await getDocs(categoriesQuery);
      const categoriesData = categoriesSnapshot.docs.map(doc => ({ firestoreId: doc.id, ...doc.data() }));
      setCategories(categoriesData);

      const citiesSnapshot = await getDocs(collection(db, 'cities'));
      const citiesData = citiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCities(citiesData);
    } catch (error) { console.error("Error al obtener los datos: ", error); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const resetFormAndCloseModal = () => {
    setOpenModal(false);
    setFormName('');
    setFormCities([]);
    setFormVisible(true);
    setFormImage(null);
    setFormPosition(0);
    setEditingCategory(null);
    setFormSubcategories([]);
  };

  const handleAddNewClick = () => {
    resetFormAndCloseModal();
    setFormPosition(categories.length + 1);
    setOpenModal(true);
  };

  const handleEditClick = (category) => {
    setEditingCategory(category);
    setFormName(category.categorieName);
    setFormCities(category.ciudades || []);
    setFormVisible(category.visible);
    setFormPosition(category.position || 0);
    setFormSubcategories(category.subcategorias?.map(sub => ({ ...sub, id: Date.now() + Math.random(), imageFile: null })) || []);
    setOpenModal(true);
  };

  const handleAddSubcategory = () => {
    setFormSubcategories([...formSubcategories, { id: Date.now(), nombre: '', ImagenUrl: '', imageFile: null }]);
  };

  const handleSubcategoryChange = (index, field, value) => {
    const updatedSubcategories = [...formSubcategories];
    updatedSubcategories[index][field] = value;
    setFormSubcategories(updatedSubcategories);
  };

  const handleRemoveSubcategory = (index) => {
    setFormSubcategories(formSubcategories.filter((_, i) => i !== index));
  };

  const handleDeleteClick = (category) => {
    setCategoryToDelete(category);
    setOpenDeleteDialog(true);
  };

  const handleCloseDeleteDialog = () => {
    setOpenDeleteDialog(false);
    setCategoryToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!categoryToDelete) return;
    setIsDeleting(true);
    try {
      if (categoryToDelete.image) {
        const imageRef = ref(storage, categoryToDelete.image);
        await deleteObject(imageRef);
      }
      // También borramos las imágenes de las subcategorías
      if (categoryToDelete.subcategorias && categoryToDelete.subcategorias.length > 0) {
        await Promise.all(categoryToDelete.subcategorias.map(async sub => {
          if (sub.ImagenUrl) {
            const subImageRef = ref(storage, sub.ImagenUrl);
            try {
              await deleteObject(subImageRef);
            } catch (storageError) {
              // Si el objeto no existe, no es un error crítico para el proceso de borrado
              if (storageError.code !== 'storage/object-not-found') {
                console.warn(`No se pudo eliminar la imagen de subcategoría: ${sub.ImagenUrl}`, storageError);
              }
            }
          }
        }));
      }
      await deleteDoc(doc(db, 'marketplace', categoryToDelete.firestoreId));
      handleCloseDeleteDialog();
      await fetchData();
      alert('¡Categoría eliminada con éxito!');
    } catch (error) {
      console.error("Error al eliminar la categoría o sus imágenes: ", error);
      // Intentar borrar el documento de Firestore incluso si falla la eliminación de Storage
      try {
        await deleteDoc(doc(db, 'marketplace', categoryToDelete.firestoreId));
        handleCloseDeleteDialog();
        await fetchData();
        alert('Categoría eliminada (algunas imágenes asociadas podrían no haberse borrado de Storage).');
      } catch (dbError) {
        console.error("Error definitivo al eliminar de Firestore: ", dbError);
        alert('Hubo un error crítico al eliminar el registro de la base de datos.');
      }
    } finally { setIsDeleting(false); }
  };

  const handleSave = async () => {
    if (!formName) { alert('Nombre es requerido.'); return; }
    if (!editingCategory && !formImage) { alert('Imagen es requerida.'); return; }
    setIsSaving(true);
    try {
      let imageUrl = editingCategory ? editingCategory.image : '';
      if (formImage) {
        const imageName = `${Date.now()}-${formImage.name}`;
        const storageRef = ref(storage, `marketplace_images/${imageName}`);
        await uploadBytes(storageRef, formImage);
        imageUrl = await getDownloadURL(storageRef);
      }

      const subcategoriesToSave = await Promise.all(
        formSubcategories.map(async (sub) => {
          let currentSubImageUrl = sub.ImagenUrl; // Mantener la URL existente por defecto
          if (sub.imageFile) { // Si hay un nuevo archivo para subir
            const subImageName = `${Date.now()}-sub-${sub.imageFile.name}`;
            const subStorageRef = ref(storage, `marketplace_images/subcategories/${subImageName}`);
            await uploadBytes(subStorageRef, sub.imageFile);
            currentSubImageUrl = await getDownloadURL(subStorageRef);
          }
          console.log(`Subcategory: ${sub.nombre}, Final ImagenUrl: ${currentSubImageUrl}`); // VERIFICACIÓN
          return { nombre: sub.nombre, imagenUrl: currentSubImageUrl }; // Aseguramos el nombre exacto del campo
        })
      );

      const categoryData = {
        categorieName: formName,
        ciudades: formCities,
        visible: formVisible,
        image: imageUrl,
        position: formPosition,
        subcategorias: subcategoriesToSave
      };
      console.log("Category data to save:", categoryData); // VERIFICACIÓN

      if (editingCategory) {
        const categoryDoc = doc(db, 'marketplace', editingCategory.firestoreId);
        await updateDoc(categoryDoc, categoryData);
      } else {
        const newCategoryData = { ...categoryData, banner_grande: false };
        const docRef = await addDoc(collection(db, 'marketplace'), newCategoryData);
        await updateDoc(docRef, { id: docRef.id });
      }
      resetFormAndCloseModal();
      await fetchData();
      alert(`¡Categoría ${editingCategory ? 'actualizada' : 'guardada'}!`);
    } catch (error) {
      console.error("Error guardando: ", error);
      alert('Error al guardar.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = categories.findIndex((c) => c.firestoreId === active.id);
      const newIndex = categories.findIndex((c) => c.firestoreId === over.id);
      const newOrder = arrayMove(categories, oldIndex, newIndex);
      setCategories(newOrder);
      try {
        const batch = writeBatch(db);
        newOrder.forEach((category, index) => {
          const newPosition = index + 1;
          if (category.position !== newPosition) {
            const categoryRef = doc(db, 'marketplace', category.firestoreId);
            batch.update(categoryRef, { position: newPosition });
          }
        });
        await batch.commit();
        await fetchData();
      } catch (error) {
        console.error("Error al actualizar posiciones: ", error);
        alert("Hubo un error al guardar el nuevo orden.");
        fetchData();
      }
    }
  };
  
  if (loading) { return <Typography>Cargando datos...</Typography>; }

  return (
    <PageContext.Provider value={{ handleEditClick, handleDeleteClick }}>
      <Box sx={{ padding: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" gutterBottom>Gestión de Marketplace</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddNewClick}>Agregar Categoría</Button>
        </Box>
        
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 50 }}></TableCell>
                  <TableCell>Imagen</TableCell>
                  <TableCell>Nombre de Categoría</TableCell>
                  <TableCell>Visible</TableCell>
                  <TableCell>Posición</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <SortableContext items={categories.map(c => c.firestoreId)} strategy={verticalListSortingStrategy}>
                <TableBody>
                  {categories.map(category => (
                    <SortableCategoryRow key={category.firestoreId} category={category} />
                  ))}
                </TableBody>
              </SortableContext>
            </Table>
          </TableContainer>
        </DndContext>

        <Modal open={openModal} onClose={resetFormAndCloseModal}>
          <Box sx={style}>
            <Typography variant="h6">{editingCategory ? 'Editar Categoría' : 'Crear Nueva Categoría'}</Typography>
            <TextField label="Nombre de Categoría" fullWidth value={formName} onChange={(e) => setFormName(e.target.value)} />
            <TextField label="Posición" type="number" fullWidth value={formPosition} onChange={(e) => setFormPosition(parseInt(e.target.value, 10) || 0)} />
            <FormControl fullWidth>
              <InputLabel>Ciudades Disponibles</InputLabel>
              <Select multiple value={formCities} onChange={(e) => setFormCities(e.target.value)} input={<OutlinedInput label="Ciudades Disponibles" />} renderValue={(selected) => selected.join(', ')}>
                {cities.map((city) => ( <MenuItem key={city.id} value={city.nombreCiudad}><Checkbox checked={formCities.indexOf(city.nombreCiudad) > -1} />{city.nombreCiudad}</MenuItem> ))}
              </Select>
            </FormControl>
            <FormControlLabel control={<Switch checked={formVisible} onChange={(e) => setFormVisible(e.target.checked)}/>} label="Visible" />
            {editingCategory && editingCategory.image && (<Box component="img" src={editingCategory.image} sx={{ width: '100%', borderRadius: '4px', mb: 1, maxHeight: 150, objectFit: 'contain' }} />)}
            <Button variant="outlined" component="label">
              {formImage ? `Archivo: ${formImage.name}` : (editingCategory ? 'Cambiar Imagen' : 'Subir Imagen')}
              <input type="file" hidden onChange={(e) => setFormImage(e.target.files[0])} />
            </Button>
            
            <Divider sx={{ my: 2 }}>Subcategorías (Opcional)</Divider>
            {formSubcategories.map((sub, index) => (
              <Box key={sub.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TextField label="Nombre Subcategoría" size="small" value={sub.nombre} onChange={(e) => handleSubcategoryChange(index, 'nombre', e.target.value)} sx={{ flexGrow: 1 }} />
                <Button variant="outlined" size="small" component="label" sx={{ flexShrink: 0, minWidth: 120 }}>
                  {sub.imageFile ? 'Archivo ✓' : (sub.ImagenUrl && !sub.imageFile ? 'Cambiar Img' : 'Subir Img')}
                  <input type="file" hidden onChange={(e) => handleSubcategoryChange(index, 'imageFile', e.target.files[0])} />
                </Button>
                {sub.ImagenUrl && !sub.imageFile && <Box component="img" src={sub.ImagenUrl} sx={{ height: 30, width: 30, objectFit: 'cover' }} />}
                <IconButton color="error" onClick={() => handleRemoveSubcategory(index)}><DeleteIcon /></IconButton>
              </Box>
            ))}
            <Button startIcon={<AddIcon />} onClick={handleAddSubcategory}>Añadir Subcategoría</Button>
            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
              <Button onClick={resetFormAndCloseModal}>Cancelar</Button>
              <Button variant="contained" onClick={handleSave} disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar'}</Button>
            </Box>
          </Box>
        </Modal>

        <Dialog open={openDeleteDialog} onClose={handleCloseDeleteDialog}>
          <DialogTitle>Confirmar Eliminación</DialogTitle>
          <DialogContent>
            <DialogContentText>
              ¿Estás seguro de que quieres eliminar la categoría "{categoryToDelete?.categorieName}"? <br /> Esta acción no se puede deshacer.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDeleteDialog}>Cancelar</Button>
            <Button onClick={handleConfirmDelete} color="error" disabled={isDeleting} autoFocus>{isDeleting ? 'Eliminando...' : 'Eliminar'}</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </PageContext.Provider>
  );
}

export default MarketplacePage;