import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { db, storage } from '../firebase/config';
import {
  collection, query, where, getDocs, orderBy,
  doc, writeBatch, deleteDoc, getDoc
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';

import {
  Typography, Box, Paper, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Breadcrumbs, Switch, Grid, FormControl, InputLabel,
  Select, MenuItem, TextField, IconButton
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';

function ProductsPage() {
  const { uuidEmpresa } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [businessData, setBusinessData] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSupermarket, setIsSupermarket] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('cat') || 'Todas');
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');

  // Función unificada para buscar productos
  const handleProductSearch = useCallback(async (category, term) => {
    setLoading(true);
    try {
      const base = [collection(db, 'productos'), where('uuidEmpresa', '==', uuidEmpresa)];
      if (category && category !== 'Todas') {
        base.push(where('categorias', 'array-contains', category));
      }
      const qy = query(...base);
      const snap = await getDocs(qy);
      let data = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
      if (term) {
        const t = term.toLowerCase();
        data = data.filter(p =>
          (p.name || '').toLowerCase().includes(t) ||
          (p.sku || '').toLowerCase().includes(t)
        );
      }
      setProducts(data);
    } catch (e) { 
      console.error("Error al buscar productos:", e);
    } finally { 
      setLoading(false); 
    }
  }, [uuidEmpresa]);

  // Efecto principal para cargar datos
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (!uuidEmpresa) return;

      const businessQuery = query(collection(db, 'NegociosAfiliados'), where('uuidEmpresa', '==', uuidEmpresa));
      const businessSnapshot = await getDocs(businessQuery);
      if (businessSnapshot.empty) {
          setLoading(false);
          return;
      };
      
      const business = businessSnapshot.docs[0].data();
      setBusinessData(business);
      const isSuper = business.mostrarComoSuper === true;
      setIsSupermarket(isSuper);

      const categoriesQuery = query(collection(db, 'Categorias'), where('uuidEmpresa', '==', uuidEmpresa), orderBy('posicion', 'asc'));
      const categoriesSnapshot = await getDocs(categoriesQuery);
      setCategories(categoriesSnapshot.docs.map(d => ({ firestoreId: d.id, ...d.data() })));
      
      // --- LÓGICA DE CARGA MEJORADA ---
      const initialCategory = searchParams.get('cat') || 'Todas';
      const initialSearch = searchParams.get('q') || '';

      // Si NO es supermercado, O SI hay filtros en la URL, ejecuta la búsqueda inmediatamente.
      if (!isSuper || (initialCategory !== 'Todas' || initialSearch)) {
        // Llamamos a la función de búsqueda con los filtros iniciales de la URL
        await handleProductSearch(initialCategory, initialSearch);
      } else {
        setProducts([]); // Si es super y no hay filtros, la lista empieza vacía
      }

    } catch (e) { 
      console.error("Error en fetchData:", e);
    } finally { 
      setLoading(false); 
    }
  }, [uuidEmpresa, searchParams, handleProductSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // useEffect para actualizar la URL cuando los filtros del estado cambian
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const setOrDelete = (key, value, defaultValue) => {
      if (value && value !== defaultValue) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    };
    setOrDelete('cat', selectedCategory, 'Todas');
    setOrDelete('q', searchTerm, '');
    
    // Solo actualizamos si la URL es diferente para evitar bucles
    if (params.toString() !== searchParams.toString()) {
        setSearchParams(params, { replace: true });
    }
  }, [selectedCategory, searchTerm, searchParams, setSearchParams]);

  const handleDelete = useCallback(async (product) => {
    if (!window.confirm(`¿Eliminar "${product.name}"?`)) return;

    setLoading(true);
    try {
      const productUuid = product.uuid;
      if (productUuid) {
        const modsQ = query(collection(db, 'modifierGroups'), where('productoId', '==', productUuid));
        const modsSnap = await getDocs(modsQ);
        const batch = writeBatch(db);
        modsSnap.forEach(m => batch.delete(doc(db, 'modifierGroups', m.id)));
        batch.delete(doc(db, 'productos', product.firestoreId));
        await batch.commit();
      } else {
        await deleteDoc(doc(db, 'productos', product.firestoreId));
      }
      if (productUuid) {
        const imgRef = ref(storage, `product_images/${uuidEmpresa}/${productUuid}`);
        await deleteObject(imgRef).catch(err => console.warn("Imagen no encontrada en Storage:", err));
      }
      setProducts(prev => prev.filter(p => p.firestoreId !== product.firestoreId));
    } catch (e) {
      console.error(e);
      window.alert('Error al eliminar el producto.');
    } finally {
      setLoading(false);
    }
  }, [uuidEmpresa]);

  if (loading) return <Typography>Cargando información...</Typography>;
  if (!businessData) return <Typography>No se pudo cargar la información del negocio.</Typography>;

  return (
    <Box>
      <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 2 }}>
        <Link to={`/negocios?${searchParams.toString()}`} style={{ textDecoration: 'none', color: 'inherit' }}>Negocios</Link>
        <Typography color="text.primary">{businessData.NombredelNegocio}</Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Productos de "{businessData.NombredelNegocio}"</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate(`/negocios/${uuidEmpresa}/productos/nuevo?${searchParams.toString()}`)}
        >
          Agregar Producto
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Categoría</InputLabel>
              <Select
                value={selectedCategory}
                label="Categoría"
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <MenuItem value="Todas">Todas las Categorías</MenuItem>
                {categories.map(cat => (
                  <MenuItem key={cat.firestoreId} value={cat.Categoria}>{cat.Categoria}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Buscar por nombre o SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleProductSearch(selectedCategory, searchTerm)}
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            <Button variant="contained" fullWidth onClick={() => handleProductSearch(selectedCategory, searchTerm)} startIcon={<SearchIcon />}>
              Buscar
            </Button>
          </Grid>
        </Grid>
        {isSupermarket && (
          <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
            Para supermercados, los productos no se cargan hasta que filtres o busques.
          </Typography>
        )}
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Imagen</TableCell><TableCell>Nombre</TableCell><TableCell>Costo</TableCell>
              <TableCell>Venta</TableCell><TableCell>Disponible</TableCell><TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {products.length ? products.map(p => (
              <TableRow key={p.firestoreId}>
                <TableCell>
                  {p.Imagen
                    ? <img src={p.Imagen} alt={p.name} style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 4 }} />
                    : '—'}
                </TableCell>
                <TableCell>{p.name}</TableCell>
                <TableCell>L {Number(p.price || 0).toFixed(2)}</TableCell>
                <TableCell>
                  {p.tiene_descuento ? (
                    <>
                      <Typography variant="body2" sx={{ textDecoration: 'line-through', color: 'text.secondary' }}>
                        L {Number(p.sale_price || 0).toFixed(2)}
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                        L {Number(p.precio_descuento || 0).toFixed(2)}
                      </Typography>
                    </>
                  ) : (
                    <Typography>L {Number(p.sale_price || 0).toFixed(2)}</Typography>
                  )}
                </TableCell>
                <TableCell><Switch checked={!!p.disponible} readOnly /></TableCell>
                <TableCell align="right">
                  <IconButton
                    color="primary"
                    onClick={() => navigate(`/negocios/${uuidEmpresa}/productos/${p.firestoreId}/editar?${searchParams.toString()}`)}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton color="error" onClick={() => handleDelete(p)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  {isSupermarket && !searchTerm && selectedCategory === 'Todas' ? 'Selecciona una categoría o busca.' : 'No se encontraron productos.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}



export default ProductsPage;